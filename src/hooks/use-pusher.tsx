"use client";

// src/hooks/use-pusher.tsx
import { PusherChannels } from "@/lib/pusher-server";
import Pusher, { Channel } from "pusher-js";
import { useEffect, useState } from "react";

let pusherClient: Pusher | null = null;

const getPusher = () => {
  if (!pusherClient) {
    // Initialize Pusher client
    pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    });
  }

  return pusherClient;
};

type UseChannelOptions = {
  enabled?: boolean;
};

type ChannelEvents<C extends keyof PusherChannels> = {
  [E in keyof PusherChannels[C]]?: (data: PusherChannels[C][E]) => void;
};

/**
 * Hook to subscribe to a Pusher channel and handle events
 */
export function usePusherChannel<C extends keyof PusherChannels>(
  channelName: C,
  events: ChannelEvents<C>,
  options: UseChannelOptions = {},
) {
  const { enabled = true } = options;
  const [channel, setChannel] = useState<Channel | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to channel
  useEffect(() => {
    if (!enabled || !channelName) return;

    try {
      const pusher = getPusher();
      const newChannel = pusher.subscribe(channelName as string);
      setChannel(newChannel);

      return () => {
        pusher.unsubscribe(channelName as string);
        setChannel(null);
      };
    } catch (err) {
      console.error(`Error subscribing to ${channelName}:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [channelName, enabled]);

  // Bind events
  useEffect(() => {
    if (!channel || !events) return;

    // Bind each event handler
    const boundEvents = Object.entries(events).map(([eventName, handler]) => {
      if (handler) {
        channel.bind(eventName, handler as (data: any) => void);
      }
      return eventName;
    });

    // Cleanup on unmount
    return () => {
      boundEvents.forEach((eventName) => {
        channel.unbind(eventName);
      });
    };
  }, [channel, events]);

  return { channel, error };
}

// Type for organization channel
type OrgChannel = Extract<keyof PusherChannels, `org-${string}`>;
type OrgEvents = PusherChannels[OrgChannel];

/**
 * Hook to subscribe to organization events
 */
export function useOrganizationEvents(
  orgId: string | undefined,
  handlers: {
    onRunCreated?: (data: OrgEvents["run-created"]) => void;
    onRunUpdated?: (data: OrgEvents["run-updated"]) => void;
    onCampaignCreated?: (data: OrgEvents["campaign-created"]) => void;
    onCampaignUpdated?: (data: OrgEvents["campaign-updated"]) => void;
  },
  options: UseChannelOptions = {},
) {
  const channelName = orgId ? (`org-${orgId}` as const) : "";
  const { enabled = !!orgId } = options;

  return usePusherChannel(
    channelName as OrgChannel,
    {
      "run-created": handlers.onRunCreated,
      "run-updated": handlers.onRunUpdated,
      "campaign-created": handlers.onCampaignCreated,
      "campaign-updated": handlers.onCampaignUpdated,
    },
    { enabled },
  );
}

// Type for run channel
type RunChannel = Extract<keyof PusherChannels, `run-${string}`>;
type RunEvents = PusherChannels[RunChannel];

/**
 * Hook to subscribe to run events
 */
export function useRunEvents(
  runId: string | undefined,
  handlers: {
    onCallStarted?: (data: RunEvents["call-started"]) => void;
    onCallCompleted?: (data: RunEvents["call-completed"]) => void;
    onCallFailed?: (data: RunEvents["call-failed"]) => void;
    onMetricsUpdated?: (data: RunEvents["metrics-updated"]) => void;
  },
  options: UseChannelOptions = {},
) {
  const channelName = runId ? (`run-${runId}` as const) : "";
  const { enabled = !!runId } = options;

  return usePusherChannel(
    channelName as RunChannel,
    {
      "call-started": handlers.onCallStarted,
      "call-completed": handlers.onCallCompleted,
      "call-failed": handlers.onCallFailed,
      "metrics-updated": handlers.onMetricsUpdated,
    },
    { enabled },
  );
}

// Type for user channel
type UserChannel = Extract<keyof PusherChannels, `user-${string}`>;
type UserEvents = PusherChannels[UserChannel];

/**
 * Hook to subscribe to user notifications
 */
export function useUserNotifications(
  userId: string | undefined,
  onNotification?: (data: UserEvents["notification"]) => void,
  options: UseChannelOptions = {},
) {
  const channelName = userId ? (`user-${userId}` as const) : "";
  const { enabled = !!userId } = options;

  return usePusherChannel(
    channelName as UserChannel,
    {
      notification: onNotification,
    },
    { enabled },
  );
}
