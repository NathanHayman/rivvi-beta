"use client";

// src/hooks/use-pusher.tsx - Improved version
import { PusherChannels } from "@/lib/pusher-server";
import Pusher, { Channel } from "pusher-js";
import { useCallback, useEffect, useRef, useState } from "react";

// Global pusher client singleton
let pusherClient: Pusher | null = null;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const getPusher = () => {
  if (!pusherClient) {
    // Check for required environment variables
    const apiKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!apiKey || !cluster) {
      console.error("Pusher environment variables missing");
      return null;
    }

    try {
      // Initialize Pusher client with error handling
      pusherClient = new Pusher(apiKey, {
        cluster,
        forceTLS: true,
        enabledTransports: ["ws", "wss"],
      });

      // Add global connection handlers for monitoring
      pusherClient.connection.bind("error", (err: any) => {
        console.error("Pusher connection error:", err);
        connectionAttempts++;

        if (connectionAttempts > MAX_RECONNECT_ATTEMPTS) {
          console.error(
            `Failed to connect to Pusher after ${MAX_RECONNECT_ATTEMPTS} attempts`,
          );
          // Disconnect to avoid indefinite reconnection attempts
          pusherClient?.disconnect();
        }
      });

      pusherClient.connection.bind("connected", () => {
        console.log("Pusher connected successfully");
        connectionAttempts = 0;
      });

      pusherClient.connection.bind("disconnected", () => {
        console.log("Pusher disconnected");
      });
    } catch (error) {
      console.error("Error initializing Pusher client:", error);
      return null;
    }
  }

  return pusherClient;
};

// Custom hook options
type UseChannelOptions = {
  enabled?: boolean;
  onError?: (error: Error) => void;
  resubscribeOnReconnect?: boolean;
};

// Event handler types
type ChannelEvents<C extends keyof PusherChannels> = {
  [E in keyof PusherChannels[C]]?: (data: PusherChannels[C][E]) => void;
};

/**
 * Improved hook to subscribe to a Pusher channel and handle events
 */
export function usePusherChannel<C extends keyof PusherChannels>(
  channelName: C,
  events: ChannelEvents<C>,
  options: UseChannelOptions = {},
) {
  const { enabled = true, onError, resubscribeOnReconnect = true } = options;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] =
    useState<string>("disconnected");

  // Track if the component is mounted
  const isMounted = useRef(true);

  // Track bound event handlers for cleanup
  const boundEvents = useRef<string[]>([]);

  // Cleanup function to unbind events and unsubscribe
  const cleanup = useCallback(() => {
    if (!channel) return;

    // Unbind all events
    boundEvents.current.forEach((eventName) => {
      channel.unbind(eventName);
    });
    boundEvents.current = [];

    // Unsubscribe from channel
    const pusher = getPusher();
    if (pusher && channelName) {
      pusher.unsubscribe(channelName as string);
    }

    if (isMounted.current) {
      setChannel(null);
    }
  }, [channel, channelName]);

  // Subscribe to channel
  useEffect(() => {
    isMounted.current = true;

    if (!enabled || !channelName) return cleanup;

    try {
      const pusher = getPusher();
      if (!pusher) {
        throw new Error("Pusher client not initialized");
      }

      // Track connection state
      setConnectionState(pusher.connection.state);

      const connectionStateHandler = (state: string) => {
        if (isMounted.current) {
          setConnectionState(state);
        }
      };

      // Subscribe to connection state changes
      pusher.connection.bind("state_change", connectionStateHandler);

      // Subscribe to channel
      console.log(`Subscribing to channel: ${channelName}`);
      const newChannel = pusher.subscribe(channelName as string);

      if (isMounted.current) {
        setChannel(newChannel);
      }

      // Cleanup function
      return () => {
        isMounted.current = false;
        pusher.connection.unbind("state_change", connectionStateHandler);
        cleanup();
      };
    } catch (err) {
      console.error(`Error subscribing to ${channelName}:`, err);
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      if (onError) onError(error);
      return cleanup;
    }
  }, [channelName, enabled, cleanup, onError]);

  // Bind events when channel or events change
  useEffect(() => {
    if (!channel || !events) return;

    // Clean up previous bindings first
    boundEvents.current.forEach((eventName) => {
      channel.unbind(eventName);
    });
    boundEvents.current = [];

    // Bind each event handler
    Object.entries(events).forEach(([eventName, handler]) => {
      if (handler) {
        try {
          // Add debugging to help trace event binding
          const wrappedHandler = (data: any) => {
            console.log(`Event received: ${eventName}`, data);
            if (typeof handler === "function") {
              handler(data);
            }
          };

          channel.bind(eventName, wrappedHandler as (data: any) => void);
          boundEvents.current.push(eventName);
        } catch (error) {
          console.error(`Error binding event ${eventName}:`, error);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      if (channel) {
        boundEvents.current.forEach((eventName) => {
          channel.unbind(eventName);
        });
        boundEvents.current = [];
      }
    };
  }, [channel, events]);

  // Handle reconnection logic
  useEffect(() => {
    if (!resubscribeOnReconnect || !channelName || !enabled) return;

    // If connection changed to connected, and we have no channel, try to resubscribe
    if (connectionState === "connected" && !channel) {
      const pusher = getPusher();
      if (pusher) {
        try {
          console.log(
            `Resubscribing to channel after reconnect: ${channelName}`,
          );
          const reconnectedChannel = pusher.subscribe(channelName as string);
          setChannel(reconnectedChannel);
        } catch (err) {
          console.error(`Error resubscribing to ${channelName}:`, err);
        }
      }
    }
  }, [connectionState, channel, channelName, enabled, resubscribeOnReconnect]);

  return {
    channel,
    error,
    connectionState,
    isConnected: connectionState === "connected",
    isConnecting: connectionState === "connecting",
    isDisconnected: connectionState === "disconnected",
  };
}

// Type for organization channel
type OrgChannel = Extract<keyof PusherChannels, `org-${string}`>;
type OrgEvents = PusherChannels[OrgChannel];

/**
 * Improved hook to subscribe to organization events
 */
export function useOrganizationEvents(
  orgId: string | undefined,
  handlers: {
    onRunCreated?: (data: OrgEvents["run-created"]) => void;
    onRunUpdated?: (data: OrgEvents["run-updated"]) => void;
    onRunPaused?: (data: OrgEvents["run-paused"]) => void;
    onCampaignCreated?: (data: OrgEvents["campaign-created"]) => void;
    onCampaignUpdated?: (data: OrgEvents["campaign-updated"]) => void;
    onCallStarted?: (data: OrgEvents["call-started"]) => void;
    onCallUpdated?: (data: OrgEvents["call-updated"]) => void;
    onInboundCall?: (data: OrgEvents["inbound-call"]) => void;
  },
  options: UseChannelOptions = {},
) {
  const channelName = orgId ? (`org-${orgId}` as const) : "";
  const { enabled = !!orgId, ...restOptions } = options;

  return usePusherChannel(
    channelName as OrgChannel,
    {
      "run-created": handlers.onRunCreated,
      "run-updated": handlers.onRunUpdated,
      "run-paused": handlers.onRunPaused,
      "campaign-created": handlers.onCampaignCreated,
      "campaign-updated": handlers.onCampaignUpdated,
      "call-started": handlers.onCallStarted,
      "call-updated": handlers.onCallUpdated,
      "inbound-call": handlers.onInboundCall,
    },
    { enabled, ...restOptions },
  );
}

// Type for run channel
type RunChannel = Extract<keyof PusherChannels, `run-${string}`>;
type RunEvents = PusherChannels[RunChannel];

/**
 * Improved hook to subscribe to run events
 */
export function useRunEvents(
  runId: string | undefined,
  handlers: {
    onCallStarted?: (data: RunEvents["call-started"]) => void;
    onCallCompleted?: (data: RunEvents["call-completed"]) => void;
    onCallFailed?: (data: RunEvents["call-failed"]) => void;
    onMetricsUpdated?: (data: RunEvents["metrics-updated"]) => void;
    onRunPaused?: (data: RunEvents["run-paused"]) => void;
  },
  options: UseChannelOptions = {},
) {
  const channelName = runId ? (`run-${runId}` as const) : "";
  const { enabled = !!runId, ...restOptions } = options;

  return usePusherChannel(
    channelName as RunChannel,
    {
      "call-started": handlers.onCallStarted,
      "call-completed": handlers.onCallCompleted,
      "call-failed": handlers.onCallFailed,
      "metrics-updated": handlers.onMetricsUpdated,
      "run-paused": handlers.onRunPaused,
    },
    { enabled, ...restOptions },
  );
}

// Type for campaign channel
type CampaignChannel = Extract<keyof PusherChannels, `campaign-${string}`>;
type CampaignEvents = PusherChannels[CampaignChannel];

/**
 * Hook to subscribe to campaign events
 */
export function useCampaignEvents(
  campaignId: string | undefined,
  handlers: {
    onRunCreated?: (data: CampaignEvents["run-created"]) => void;
    onCallCompleted?: (data: CampaignEvents["call-completed"]) => void;
  },
  options: UseChannelOptions = {},
) {
  const channelName = campaignId ? (`campaign-${campaignId}` as const) : "";
  const { enabled = !!campaignId, ...restOptions } = options;

  return usePusherChannel(
    channelName as CampaignChannel,
    {
      "run-created": handlers.onRunCreated,
      "call-completed": handlers.onCallCompleted,
    },
    { enabled, ...restOptions },
  );
}

// Type for user channel
type UserChannel = Extract<keyof PusherChannels, `user-${string}`>;
type UserEvents = PusherChannels[UserChannel];

/**
 * Improved hook to subscribe to user notifications
 */
export function useUserNotifications(
  userId: string | undefined,
  onNotification?: (data: UserEvents["notification"]) => void,
  options: UseChannelOptions = {},
) {
  const channelName = userId ? (`user-${userId}` as const) : "";
  const { enabled = !!userId, ...restOptions } = options;

  return usePusherChannel(
    channelName as UserChannel,
    {
      notification: onNotification,
    },
    { enabled, ...restOptions },
  );
}
