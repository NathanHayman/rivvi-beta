// src/lib/pusher-server.ts
import Pusher from "pusher";

// Ensure required environment variables are set
if (
  !process.env.PUSHER_APP_ID ||
  !process.env.PUSHER_KEY ||
  !process.env.PUSHER_SECRET ||
  !process.env.PUSHER_CLUSTER
) {
  throw new Error("Required Pusher environment variables are not set");
}

// Create the Pusher server instance
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

/**
 * Channel types and events for type safety
 */
export type PusherChannels = {
  // Organization-level channels
  [key: `org-${string}`]: {
    "run-created": { runId: string; campaignId: string };
    "run-updated": {
      runId: string;
      status: string;
      metadata?: Record<string, unknown>;
    };
    "campaign-created": { campaignId: string };
    "campaign-updated": { campaignId: string };
  };

  // Run-level channels
  [key: `run-${string}`]: {
    "call-started": { rowId: string; callId: string };
    "call-completed": { rowId: string; callId: string; status: string };
    "call-failed": { rowId: string; error: string };
    "metrics-updated": { runId: string; metrics: Record<string, unknown> };
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
 * Type-safe wrapper for pusher.trigger
 */
export function triggerEvent<
  Channel extends keyof PusherChannels,
  Event extends keyof PusherChannels[Channel],
>(
  channel: Channel,
  event: Event,
  data: PusherChannels[Channel][Event],
): Promise<unknown> {
  return pusherServer.trigger(
    channel as string,
    event as string,
    data as Record<string, unknown>,
  );
}

/**
 * Helper to trigger run updates with proper typing
 */
export async function triggerRunUpdate(
  orgId: string,
  runId: string,
  status: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await pusherServer.trigger(`org-${orgId}`, "run-updated", {
    runId,
    status,
    metadata,
  });
}

/**
 * Helper to trigger call events with proper typing
 */
export async function triggerCallEvent(
  runId: string,
  eventType: "call-started" | "call-completed" | "call-failed",
  data: Record<string, unknown>,
): Promise<void> {
  await pusherServer.trigger(`run-${runId}`, eventType, data);
}

/**
 * Helper to send a notification to a user
 */
export async function sendUserNotification(
  userId: string,
  message: string,
  type: "success" | "error" | "info" | "warning" = "info",
): Promise<void> {
  await pusherServer.trigger(`user-${userId}`, "notification", {
    message,
    type,
  });
}

/**
 * Authorize channel access (for private channels)
 */
export function authorizeChannel(
  socketId: string,
  channel: string,
  userData?: Record<string, unknown>,
): { auth: string; channel_data?: string } {
  if (channel.startsWith("private-")) {
    return pusherServer.authorizeChannel(socketId, channel);
  }

  if (channel.startsWith("presence-") && userData) {
    return pusherServer.authorizeChannel(socketId, channel, {
      user_id: userData.userId as string,
    });
  }

  throw new Error(`Cannot authorize channel: ${channel}`);
}
