// src/lib/pusher-server.ts - Improved version
import { env } from "@/env";
import Pusher from "pusher";

// Ensure required environment variables are set with better error handling
const requiredVars = [
  "PUSHER_APP_ID",
  "NEXT_PUBLIC_PUSHER_KEY",
  "PUSHER_SECRET",
  "NEXT_PUBLIC_PUSHER_CLUSTER",
];

const missingVars = requiredVars.filter((varName) => !env[varName]);

if (missingVars.length > 0) {
  console.error(
    `Missing required Pusher environment variables: ${missingVars.join(", ")}`,
  );

  // Rather than throw, use a mock implementation for development/testing
  if (process.env.NODE_ENV !== "production") {
    console.warn("Using mock Pusher implementation for development");
  } else {
    throw new Error(
      `Required Pusher environment variables are not set: ${missingVars.join(", ")}`,
    );
  }
}

// Create the Pusher server instance with error handling
const createPusherInstance = () => {
  try {
    return new Pusher({
      appId: env.PUSHER_APP_ID || "mock-app-id",
      key: env.NEXT_PUBLIC_PUSHER_KEY || "mock-key",
      secret: env.PUSHER_SECRET || "mock-secret",
      cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
      useTLS: true,
    });
  } catch (error) {
    console.error("Error creating Pusher instance:", error);

    // Return a mock implementation that doesn't crash the app
    return {
      trigger: async (...args) => {
        console.log("MOCK PUSHER TRIGGER:", ...args);
        return Promise.resolve();
      },
      authorizeChannel: (...args) => {
        console.log("MOCK PUSHER AUTH:", ...args);
        return { auth: "mock-auth-token" };
      },
    } as unknown as Pusher;
  }
};

export const pusherServer = createPusherInstance();

/**
 * Channel types and events for type safety
 */
export type PusherChannels = {
  // Organization-level channels
  [key: `org-${string}`]: {
    "run-created": { runId: string; campaignId: string; name: string };
    "run-updated": {
      runId: string;
      status: string;
      metadata?: Record<string, unknown>;
    };
    "run-paused": {
      runId: string;
      reason: string;
      pausedAt: string;
    };
    "campaign-created": { campaignId: string; name: string };
    "campaign-updated": { campaignId: string; name: string };
    "call-started": { runId: string; rowId: string; callId: string };
    "call-updated": {
      callId: string;
      status: string;
      patientId?: string;
      runId?: string;
      metadata?: Record<string, unknown>;
      analysis?: Record<string, unknown>;
      insights?: Record<string, unknown>;
    };
    "inbound-call": {
      callId: string;
      patientId?: string;
      fromNumber: string;
      toNumber: string;
      retellCallId: string;
      time: string;
    };
  };

  // Run-level channels
  [key: `run-${string}`]: {
    "call-started": {
      rowId: string;
      callId: string;
      variables?: Record<string, unknown>;
    };
    "call-completed": {
      rowId: string;
      callId: string;
      status: string;
      metadata?: Record<string, unknown>;
      analysis?: Record<string, unknown>;
      insights?: Record<string, unknown>;
    };
    "call-failed": { rowId: string; error: string };
    "metrics-updated": { runId: string; metrics: Record<string, unknown> };
    "run-paused": { reason: string; pausedAt: string };
  };

  // Campaign-level channels
  [key: `campaign-${string}`]: {
    "run-created": { runId: string; name: string };
    "call-completed": {
      callId: string;
      status: string;
      patientId?: string;
      analysis?: Record<string, unknown>;
      insights?: Record<string, unknown>;
    };
  };

  // User-level channels
  [key: `user-${string}`]: {
    notification: {
      message: string;
      type: "success" | "error" | "info" | "warning";
    };
  };
};

/**
 * Type-safe wrapper for pusher.trigger with error handling
 */
export async function triggerEvent<
  Channel extends keyof PusherChannels,
  Event extends keyof PusherChannels[Channel],
>(
  channel: Channel,
  event: Event,
  data: PusherChannels[Channel][Event],
): Promise<unknown> {
  try {
    console.log(
      `Triggering Pusher event: ${String(event)} on channel ${String(channel)}`,
    );

    return await pusherServer.trigger(
      channel as string,
      event as string,
      data as Record<string, unknown>,
    );
  } catch (error) {
    console.error(
      `Error triggering Pusher event ${String(event)} on ${String(channel)}:`,
      error,
    );
    // Don't rethrow to prevent app crashes
    return null;
  }
}

/**
 * Helper to trigger run updates with proper typing and error handling
 */
export async function triggerRunUpdate(
  orgId: string,
  runId: string,
  status: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await pusherServer.trigger(`org-${orgId}`, "run-updated", {
      runId,
      status,
      metadata,
    });

    console.log(
      `Triggered run-updated event for run ${runId} (status: ${status})`,
    );
  } catch (error) {
    console.error(`Error triggering run update for ${runId}:`, error);
  }
}

/**
 * Helper to trigger call events with proper typing and error handling
 */
export async function triggerCallEvent(
  runId: string,
  eventType: "call-started" | "call-completed" | "call-failed",
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await pusherServer.trigger(`run-${runId}`, eventType, data);
    console.log(`Triggered ${eventType} event for run ${runId}`);
  } catch (error) {
    console.error(`Error triggering call event for run ${runId}:`, error);
  }
}

/**
 * Helper to send a notification to a user with error handling
 */
export async function sendUserNotification(
  userId: string,
  message: string,
  type: "success" | "error" | "info" | "warning" = "info",
): Promise<void> {
  try {
    await pusherServer.trigger(`user-${userId}`, "notification", {
      message,
      type,
    });
    console.log(`Sent notification to user ${userId}: ${message}`);
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
  }
}

/**
 * Authorize channel access (for private channels) with error handling
 */
export function authorizeChannel(
  socketId: string,
  channel: string,
  userData?: Record<string, unknown>,
): { auth: string; channel_data?: string } {
  try {
    if (channel.startsWith("private-")) {
      return pusherServer.authorizeChannel(socketId, channel);
    }

    if (channel.startsWith("presence-") && userData) {
      return pusherServer.authorizeChannel(socketId, channel, {
        user_id: userData.userId as string,
        user_info: userData,
      });
    }

    throw new Error(`Cannot authorize channel: ${channel}`);
  } catch (error) {
    console.error(`Error authorizing channel ${channel}:`, error);
    // Return fallback auth to prevent crashes
    return { auth: "error-fallback-auth" };
  }
}

/**
 * Trigger multiple events in a batch to minimize network requests
 */
export async function triggerBatchEvents(
  events: Array<{
    channel: string;
    event: string;
    data: Record<string, unknown>;
  }>,
): Promise<void> {
  if (events.length === 0) return;

  try {
    // Avoid exceeding batch API limits
    const batchSize = 10;

    // Process in chunks of batchSize
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      await pusherServer.triggerBatch(
        batch.map(({ event, ...rest }) => ({
          name: event,
          ...rest,
        })),
      );
    }

    console.log(`Triggered batch of ${events.length} Pusher events`);
  } catch (error) {
    console.error("Error triggering batch events:", error);
  }
}

/**
 * Check if a channel exists (for debugging)
 */
export async function checkChannelExists(channel: string): Promise<boolean> {
  try {
    const response = await pusherServer.get({ path: `/channels/${channel}` });
    return response.status === 200;
  } catch (error) {
    console.error(`Error checking if channel ${channel} exists:`, error);
    return false;
  }
}

/**
 * Get active users on a presence channel
 */
export async function getChannelUsers(
  channel: string,
): Promise<Array<Record<string, any>>> {
  if (!channel.startsWith("presence-")) {
    console.error(`Cannot get users for non-presence channel: ${channel}`);
    return [];
  }

  try {
    const response = await pusherServer.get({
      path: `/channels/${channel}/users`,
    });
    if (response.status === 200) {
      const responseData = await response.json();
      return responseData.users || [];
    }
    return [];
  } catch (error) {
    console.error(`Error getting users for channel ${channel}:`, error);
    return [];
  }
}
