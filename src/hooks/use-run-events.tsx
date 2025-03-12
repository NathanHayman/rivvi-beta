// Modified file: src/hooks/use-run-events.ts
// This is the updated useRunEvents hook implementation with voicemail handling

import { PusherChannels } from "@/lib/pusher-server";
import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * Improved hook to handle run event metrics with proper voicemail counting
 */
export function useRunMetrics(runId: string | undefined, enabled = true) {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track last update time
  const lastUpdateRef = useRef<number>(Date.now());

  // Create a debounced metrics setter to prevent too many updates
  const [debouncedSetMetrics] = useDebounce((newMetrics: any) => {
    setMetrics((prev: any) => {
      // Skip update if metrics haven't changed
      if (prev && JSON.stringify(prev) === JSON.stringify(newMetrics)) {
        return prev;
      }
      return newMetrics;
    });
    setIsLoading(false);
  }, 500);

  // Handler for metrics updates
  const handleMetricsUpdated = useCallback(
    (data: any) => {
      console.log("Run metrics updated");
      lastUpdateRef.current = Date.now();

      // Ensure voicemail count is properly tracked
      if (data.metrics?.calls) {
        // Make sure voicemail field is properly synchronized
        if (
          data.metrics.calls.voicemails !== undefined &&
          data.metrics.calls.voicemail === undefined
        ) {
          // Copy voicemails to voicemail to ensure consistency
          data.metrics.calls.voicemail = data.metrics.calls.voicemails;
        } else if (
          data.metrics.calls.voicemail !== undefined &&
          data.metrics.calls.voicemails === undefined
        ) {
          // Copy voicemail to voicemails to ensure consistency
          data.metrics.calls.voicemails = data.metrics.calls.voicemail;
        }
      }

      debouncedSetMetrics(data.metrics);
    },
    [debouncedSetMetrics],
  );

  // Handle errors
  const handleError = useCallback((e: Error) => {
    console.error("Run events error:", e);
    setError(e);
    setIsLoading(false);
  }, []);

  // Subscribe to run events
  const { connectionState } = useRunEvents(
    runId,
    { onMetricsUpdated: handleMetricsUpdated },
    {
      enabled,
    },
  );

  // Fetch initial metrics if available
  useEffect(() => {
    if (runId) {
      // Fetch initial metrics data
      const fetchInitialMetrics = async () => {
        try {
          const response = await fetch(`/api/runs/${runId}/metrics`);
          if (response.ok) {
            const data = await response.json();
            handleMetricsUpdated({ metrics: data });
          }
        } catch (e) {
          console.error("Error fetching initial metrics:", e);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
      fetchInitialMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return {
    metrics,
    isLoading: isLoading && enabled,
    error,
    connected: connectionState === "connected",
    lastUpdated: lastUpdateRef.current,
  };
}
