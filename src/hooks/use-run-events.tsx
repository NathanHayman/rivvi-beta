"use client";

import { PusherChannels } from "@/lib/pusher-server";
import { usePusherChannel } from "./use-pusher";

type RunChannel = Extract<keyof PusherChannels, `run-${string}`>;
type RunEvents = PusherChannels[RunChannel];

type UseChannelOptions = {
  enabled?: boolean;
  onError?: (error: Error) => void;
  resubscribeOnReconnect?: boolean;
};

/**
 * Enhanced hook to subscribe to run events, including status changes
 */
export function useRunEvents(
  runId: string | undefined,
  handlers: {
    onCallStarted?: (data: RunEvents["call-started"]) => void;
    onCallCompleted?: (data: RunEvents["call-completed"]) => void;
    onCallFailed?: (data: RunEvents["call-failed"]) => void;
    onMetricsUpdated?: (data: RunEvents["metrics-updated"]) => void;
    onRunPaused?: (data: RunEvents["run-paused"]) => void;
    onRunStatusChanged?: (data: RunEvents["run-status-changed"]) => void;
    onRowUpdated?: (data: RunEvents["row-updated"]) => void;
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
      "run-status-changed": handlers.onRunStatusChanged,
      "row-updated": handlers.onRowUpdated,
    },
    { enabled, ...restOptions },
  );
}
