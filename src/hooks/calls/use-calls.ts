// src/hooks/calls/use-calls.ts
import { getCall, getCalls, GetCallsParams } from "@/server/actions/calls";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";

type CallsHookReturn = {
  data: {
    calls: any[];
    totalCount: number;
    hasMore: boolean;
  } | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

type CallHookReturn = {
  data: any | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

/**
 * Enhanced hook to fetch calls with better state management and performance
 */
export function useCalls(filters: GetCallsParams): CallsHookReturn {
  const [data, setData] = useState<{
    calls: any[];
    totalCount: number;
    hasMore: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);

  // Use ref to track if initial fetch has happened
  const hasInitialFetchRef = useRef<boolean>(false);

  // Ref to store the last filter params to prevent unnecessary fetches
  const lastFiltersRef = useRef<string>("");

  // Keep track of auto-refresh interval
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce the search parameter with longer delay for better UX
  const [debouncedSearch] = useDebounce(filters.search, 500);

  // Helper to serialize filter object for comparison
  const serializeFilters = useCallback((filtersObj: GetCallsParams): string => {
    return JSON.stringify({
      limit: filtersObj.limit || 10,
      offset: filtersObj.offset || 0,
      status: filtersObj.status,
      direction: filtersObj.direction,
      search: filtersObj.search,
      patientId: filtersObj.patientId,
      campaignId: filtersObj.campaignId,
      startDate:
        filtersObj.startDate instanceof Date
          ? filtersObj.startDate.toISOString()
          : filtersObj.startDate,
      endDate:
        filtersObj.endDate instanceof Date
          ? filtersObj.endDate.toISOString()
          : filtersObj.endDate,
    });
  }, []);

  // Fetch calls with current filters - improved to handle date objects
  const fetchCalls = useCallback(
    async (showLoading = true) => {
      // Skip redundant fetches with same parameters
      const serializedFilters = serializeFilters({
        ...filters,
        search: debouncedSearch,
      });

      if (
        serializedFilters === lastFiltersRef.current &&
        hasInitialFetchRef.current
      ) {
        return;
      }

      // Update last filters
      lastFiltersRef.current = serializedFilters;

      // Update loading state
      if (showLoading) {
        setIsLoading(true);
      } else if (!hasInitialFetchRef.current) {
        setIsLoading(true);
      } else {
        setIsRefetching(true);
      }

      // Clear previous errors
      setError(null);

      try {
        // Prepare date parameters
        const startDate =
          filters.startDate instanceof Date
            ? filters.startDate.toISOString()
            : filters.startDate;

        const endDate =
          filters.endDate instanceof Date
            ? filters.endDate.toISOString()
            : filters.endDate;

        const result = await getCalls({
          limit: filters.limit || 10,
          offset: filters.offset || 0,
          status: filters.status,
          direction: filters.direction,
          search: debouncedSearch,
          patientId: filters.patientId,
          campaignId: filters.campaignId,
          startDate,
          endDate,
        });

        // Update state with new data
        setData(result);
        hasInitialFetchRef.current = true;
      } catch (err) {
        console.error("Error fetching calls:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch calls"),
        );
      } finally {
        setIsLoading(false);
        setIsRefetching(false);
      }
    },
    [
      filters.limit,
      filters.offset,
      filters.status,
      filters.direction,
      debouncedSearch,
      filters.patientId,
      filters.campaignId,
      filters.startDate,
      filters.endDate,
      serializeFilters,
    ],
  );

  // Set up auto-refresh and fetch on filters change
  useEffect(() => {
    // Initial fetch
    fetchCalls();

    // Set up auto-refresh with a more reasonable interval (60 seconds)
    autoRefreshIntervalRef.current = setInterval(() => {
      // Use the refetch method that doesn't show the full loading state
      fetchCalls(false);
    }, 60000); // 60 seconds

    // Clean up on unmount
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [fetchCalls]);

  // Public refetch method
  const refetch = useCallback(async () => {
    await fetchCalls(false);
  }, [fetchCalls]);

  return {
    data,
    isLoading: isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch a single call by ID with better error handling and caching
 */
export function useCall(callId: string | null): CallHookReturn {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(callId !== null);
  const [error, setError] = useState<Error | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  // Track auto-refresh interval
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCall = useCallback(async () => {
    if (!callId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getCall(callId);

      // Only update state if component is still mounted
      if (isMounted.current) {
        setData(result);
      }
    } catch (err) {
      console.error(`Error fetching call ${callId}:`, err);

      // Only update state if component is still mounted
      if (isMounted.current) {
        setError(
          err instanceof Error
            ? err
            : new Error(`Failed to fetch call ${callId}`),
        );
      }
    } finally {
      // Only update state if component is still mounted
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [callId]);

  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;

    // Fetch data initially
    fetchCall();

    // Set up auto-refresh for active calls, only if we have a callId
    if (callId) {
      refreshIntervalRef.current = setInterval(() => {
        fetchCall();
      }, 15000); // 15 seconds - more reasonable interval
    }

    // Clean up
    return () => {
      isMounted.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchCall, callId]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchCall,
  };
}
