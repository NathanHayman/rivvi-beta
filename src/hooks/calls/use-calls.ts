// src/hooks/calls/use-calls.ts
import { getCall, getCalls } from "@/server/actions/calls";
import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

// Define types
type CallFilters = {
  limit?: number;
  offset?: number;
  status?: string;
  direction?: string;
  search?: string;
  patientId?: string;
};

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

type CallTranscriptHookReturn = {
  data: { transcript: string | null } | null;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Hook to fetch calls with filtering
 */
export function useCalls(filters: CallFilters): CallsHookReturn {
  const [data, setData] = useState<{
    calls: any[];
    totalCount: number;
    hasMore: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Debounce the search parameter to prevent excessive fetching
  const [debouncedSearch] = useDebounce(filters.search, 500);

  // Memoize the fetch function to avoid recreating it on every render
  const fetchCalls = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getCalls({
        limit: filters.limit || 20,
        offset: filters.offset || 0,
        status: filters.status,
        direction: filters.direction,
        search: debouncedSearch,
        patientId: filters.patientId,
      });

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch calls"));
    } finally {
      setIsLoading(false);
    }
  }, [
    filters.limit,
    filters.offset,
    filters.status,
    filters.direction,
    debouncedSearch,
    filters.patientId,
  ]);

  // Fetch data when filters change
  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchCalls,
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
  }, [fetchCall]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchCall,
  };
}
