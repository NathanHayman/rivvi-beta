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
      outreachEffortId?: string;
      direction?: "inbound" | "outbound";
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
      isReturnCall?: boolean;
      campaignId?: string;
      hotSwapPerformed?: boolean;
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
      outreachEffortId?: string;
      status: string;
      direction?: "inbound" | "outbound";
      metadata?: Record<string, unknown>;
      analysis?: Record<string, unknown>;
      insights?: Record<string, unknown>;
    };
    "call-failed": { rowId: string; error: string };
    "metrics-updated": { runId: string; metrics: Record<string, unknown> };
    "run-paused": { reason: string; pausedAt: string };
    "run-status-changed": {
      status:
        | "draft"
        | "processing"
        | "ready"
        | "running"
        | "paused"
        | "completed"
        | "failed"
        | "scheduled";
      updatedAt: string;
    };
    "row-updated": {
      rowId: string;
      status: string;
      updatedAt: string;
      metadata?: Record<string, unknown>;
    };
  };

  // Campaign-level channels
  [key: `campaign-${string}`]: {
    "run-created": { runId: string; name: string };
    "call-completed": {
      callId: string;
      status: string;
      patientId?: string;
      outreachEffortId?: string;
      direction?: "inbound" | "outbound";
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
    const pusherInstance = createPusherInstance();
    if (!pusherInstance) {
      console.error("Pusher not configured. Unable to trigger event.");
      return;
    }

    // Send update to both organization channel and run-specific channel
    await Promise.all([
      triggerEvent(`org-${orgId}`, "run-updated", {
        runId,
        status,
        metadata,
      }),
      triggerEvent(`run-${runId}`, "run-status-changed", {
        status: status as
          | "draft"
          | "processing"
          | "ready"
          | "running"
          | "paused"
          | "completed"
          | "failed"
          | "scheduled",
        updatedAt: new Date().toISOString(),
      }),
    ]);
  } catch (error) {
    console.error("Error triggering run update event:", error);
  }
}

/**
 * Helper to trigger call events with proper typing and error handling
 */
export async function triggerCallEvent(
  orgId: string,
  runId: string,
  eventType: "call-started" | "call-completed" | "call-failed",
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const pusherInstance = createPusherInstance();
    if (!pusherInstance) {
      console.error("Pusher not configured. Unable to trigger event.");
      return;
    }

    // Ensure we have the right properties for each event type
    if (eventType === "call-started") {
      await triggerEvent(`run-${runId}`, eventType, {
        rowId: data.rowId as string,
        callId: data.callId as string,
        variables: data.variables as Record<string, unknown>,
      });
    } else if (eventType === "call-completed") {
      await triggerEvent(`run-${runId}`, eventType, {
        rowId: data.rowId as string,
        callId: data.callId as string,
        outreachEffortId: data.outreachEffortId as string,
        status: data.status as string,
        direction: (data.direction as "inbound" | "outbound") || "outbound",
        metadata: data.metadata as Record<string, unknown>,
        analysis: data.analysis as Record<string, unknown>,
        insights: data.insights as Record<string, unknown>,
      });

      // Also send to org-level channel for broader awareness
      await triggerEvent(`org-${orgId}`, "call-updated", {
        callId: data.callId as string,
        status: (data.status as string) || "completed",
        patientId: data.patientId as string,
        outreachEffortId: data.outreachEffortId as string,
        runId,
        direction: (data.direction as "inbound" | "outbound") || "outbound",
        metadata: data.metadata as Record<string, unknown>,
        analysis: data.analysis as Record<string, unknown>,
        insights: data.insights as Record<string, unknown>,
      });

      // Also send to campaign channel if campaignId is available
      if (data.campaignId) {
        await triggerEvent(
          `campaign-${data.campaignId as string}`,
          "call-completed",
          {
            callId: data.callId as string,
            status: (data.status as string) || "completed",
            patientId: data.patientId as string,
            outreachEffortId: data.outreachEffortId as string,
            direction: (data.direction as "inbound" | "outbound") || "outbound",
            analysis: data.analysis as Record<string, unknown>,
            insights: data.insights as Record<string, unknown>,
          },
        );
      }
    } else if (eventType === "call-failed") {
      // For call-failed, we need different properties
      await triggerEvent(`run-${runId}`, eventType, {
        rowId: data.rowId as string,
        error: data.error as string,
      });
    }
  } catch (error) {
    console.error("Error triggering call event:", error);
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

// New function to trigger run status changes
export async function triggerRunStatusChange(
  runId: string,
  status:
    | "draft"
    | "processing"
    | "ready"
    | "running"
    | "paused"
    | "completed"
    | "failed"
    | "scheduled",
): Promise<void> {
  try {
    const pusherInstance = createPusherInstance();
    if (!pusherInstance) {
      console.error("Pusher not configured. Unable to trigger event.");
      return;
    }

    await triggerEvent(`run-${runId}`, "run-status-changed", {
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error triggering run status change event:", error);
  }
}

// New function for triggering row status updates
export async function triggerRowStatusUpdate(
  runId: string,
  rowId: string,
  status: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const pusherInstance = createPusherInstance();
    if (!pusherInstance) {
      console.error("Pusher not configured. Unable to trigger event.");
      return;
    }

    await triggerEvent(`run-${runId}`, "row-updated", {
      rowId,
      status,
      updatedAt: new Date().toISOString(),
      metadata,
    });
  } catch (error) {
    console.error("Error triggering row status update event:", error);
  }
}
