import { PusherChannels } from "@/lib/pusher-server";
import { useCallback, useRef } from "react";
import { useDebounce } from "use-debounce";
import { usePusherChannel } from "./use-pusher";

/**
 * Improved hook to subscribe to run events and handle status updates
 */
export function useRunEvents(
  runId: string | undefined,
  handlers: {
    onCallStarted?: (data: any) => void;
    onCallCompleted?: (data: any) => void;
    onCallFailed?: (data: any) => void;
    onMetricsUpdated?: (data: any) => void;
    onRunPaused?: (data: any) => void;
    onRunStatusChanged?: (data: any) => void;
  },
  options: { enabled?: boolean } = {},
) {
  const { enabled = !!runId } = options;

  // Create debounced versions of handlers
  const [debouncedCallCompleted] = useDebounce(
    (data: any) => {
      if (handlers.onCallCompleted) {
        handlers.onCallCompleted(data);
      }
    },
    100, // Short debounce to prevent duplicate events
  );

  const [debouncedMetricsUpdated] = useDebounce(
    (data: any) => {
      if (handlers.onMetricsUpdated) {
        handlers.onMetricsUpdated(data);
      }
    },
    300, // Longer debounce for metrics as they update frequently
  );

  // Keep track of seen call IDs to prevent duplicate processing
  const processedCallIds = useRef<Set<string>>(new Set());

  // Memoize event handlers to ensure consistent references
  const handleCallStarted = useCallback(
    (data: any) => {
      // Only process each call once
      if (
        data.callId &&
        !processedCallIds.current.has(`start_${data.callId}`)
      ) {
        processedCallIds.current.add(`start_${data.callId}`);

        console.log("Call started event:", data);
        if (handlers.onCallStarted) {
          handlers.onCallStarted(data);
        }
      }
    },
    [handlers],
  );

  const handleCallCompleted = useCallback(
    (data: any) => {
      // Only process each call once
      if (
        data.callId &&
        !processedCallIds.current.has(`complete_${data.callId}`)
      ) {
        processedCallIds.current.add(`complete_${data.callId}`);

        console.log("Call completed event:", data);

        // Check explicitly for voicemail status or metadata flags
        const isVoicemail =
          data.status === "voicemail" ||
          data.metadata?.wasVoicemail ||
          (data.analysis &&
            (data.analysis.voicemail_detected === true ||
              data.analysis.left_voicemail === true ||
              data.analysis.in_voicemail === true));

        // Modify data to ensure voicemail status is clearly identifiable
        if (isVoicemail && data.status !== "voicemail") {
          console.log("Detected voicemail in completed call", data.callId);
          // If it's a voicemail but not marked as such, add the wasVoicemail flag
          const updatedData = {
            ...data,
            metadata: {
              ...(data.metadata || {}),
              wasVoicemail: true,
            },
          };
          debouncedCallCompleted(updatedData);
        } else {
          debouncedCallCompleted(data);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handlers, debouncedCallCompleted],
  );

  const handleCallFailed = useCallback(
    (data: any) => {
      // Only process each call once
      if (data.callId && !processedCallIds.current.has(`fail_${data.callId}`)) {
        processedCallIds.current.add(`fail_${data.callId}`);

        console.log("Call failed event:", data);
        if (handlers.onCallFailed) {
          handlers.onCallFailed(data);
        }
      }
    },
    [handlers],
  );

  const handleMetricsUpdated = useCallback(
    (data: any) => {
      console.log("Metrics updated event (metrics summary):", {
        calls: data.metrics?.calls,
      });

      // Make sure voicemail count is properly processed
      if (
        data.metrics?.calls &&
        typeof data.metrics.calls.voicemail === "undefined"
      ) {
        // If voicemail count isn't in the metrics, check if we can derive it
        const hasVoicemailData =
          data.metrics.calls.completed !== undefined &&
          data.metrics.calls.voicemails !== undefined;

        if (hasVoicemailData) {
          // Add the voicemail count if it exists under a different key
          data.metrics.calls.voicemail = data.metrics.calls.voicemails;
          console.log("Fixed missing voicemail count in metrics");
        }
      }

      debouncedMetricsUpdated(data);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handlers, debouncedMetricsUpdated],
  );

  const handleRunPaused = useCallback(
    (data: any) => {
      console.log("Run paused event:", data);
      if (handlers.onRunPaused) {
        handlers.onRunPaused(data);
      }
    },
    [handlers],
  );

  const handleRunStatusChanged = useCallback(
    (data: any) => {
      console.log("Run status changed event:", data);
      if (handlers.onRunStatusChanged) {
        handlers.onRunStatusChanged(data);
      }
    },
    [handlers],
  );

  // Use the channel with our handler for the events
  const channelName = runId ? `run-${runId}` : "";

  return usePusherChannel(
    channelName as keyof PusherChannels,
    {
      "call-started": handleCallStarted,
      "call-completed": handleCallCompleted,
      "call-failed": handleCallFailed,
      "metrics-updated": handleMetricsUpdated,
      "run-paused": handleRunPaused,
      "run-status-changed": handleRunStatusChanged,
    },
    { enabled },
  );
}
