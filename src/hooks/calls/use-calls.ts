// src/hooks/calls/use-calls.ts
import { getCall, getCalls, GetCallsParams } from "@/server/actions/calls";
import { useCallback, useEffect, useState } from "react";
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
 * Hook to fetch calls with filtering
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

  // Debounce the search parameter to prevent excessive fetching
  const [debouncedSearch] = useDebounce(filters.search, 300);

  // Fetch calls with current filters
  const fetchCalls = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefetching(true);
      }
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

        setData(result);
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
    ],
  );

  // Fetch data immediately when filters change
  useEffect(() => {
    // If we're just changing the search query, we'll show a different loading state
    // to avoid replacing the entire table with a spinner
    const isOnlySearchChange =
      debouncedSearch !== undefined &&
      debouncedSearch !== data?.calls[0]?.searchQuery;

    fetchCalls(!isOnlySearchChange);
  }, [fetchCalls, debouncedSearch]);

  // Set up auto-refresh every 30 seconds for real-time updates
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Use the refetch method that doesn't show the full loading state
      fetchCalls(false);
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [fetchCalls]);

  return {
    data,
    isLoading: isLoading || (isRefetching && !data), // Only show loading if we don't have any data yet
    error,
    refetch: () => fetchCalls(false),
  };
}

/**
 * Hook to fetch a single call by ID
 */
export function useCall(callId: string | null): CallHookReturn {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(callId !== null);
  const [error, setError] = useState<Error | null>(null);

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
      setData(result);
    } catch (err) {
      console.error(`Error fetching call ${callId}:`, err);
      setError(
        err instanceof Error
          ? err
          : new Error(`Failed to fetch call ${callId}`),
      );
    } finally {
      setIsLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    fetchCall();

    // Set up auto-refresh for active calls
    if (callId) {
      const intervalId = setInterval(() => {
        fetchCall();
      }, 10000); // 10 seconds

      return () => clearInterval(intervalId);
    }
  }, [fetchCall, callId]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchCall,
  };
}
