// src/hooks/patients/use-patients.ts
import { getPatientCalls } from "@/server/actions/calls/fetch";
import { createPatient } from "@/server/actions/patients/create";
import {
  getPatient,
  getPatients,
  searchPatients,
} from "@/server/actions/patients/fetch";
import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

// Define types
type PatientsFilters = {
  limit?: number;
  offset?: number;
  search?: string;
};

type PatientsHookReturn = {
  data: {
    patients: any[];
    totalCount: number;
    hasMore: boolean;
  } | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

type PatientHookReturn = {
  data: any | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

type PatientCallsHookReturn = {
  data: {
    calls: any[];
  } | null;
  isLoading: boolean;
  error: Error | null;
};

type SearchPatientsInput = {
  query: string;
  limit?: number;
  includeRecentCalls?: boolean;
};

type SearchPatientsHookReturn = {
  data: {
    patients: any[];
    total: number;
  } | null;
  isLoading: boolean;
  error: Error | null;
  search: (query: string) => void;
};

type CreatePatientInput = {
  firstName: string;
  lastName: string;
  dob: string;
  primaryPhone: string;
  secondaryPhone?: string;
  emrIdInOrg?: string;
};

type CreatePatientHookReturn = {
  mutateAsync: (data: CreatePatientInput) => Promise<any>;
  isPending: boolean;
  error: Error | null;
};

/**
 * Hook to fetch patients with filtering
 */
export function usePatients(filters: PatientsFilters = {}): PatientsHookReturn {
  const [data, setData] = useState<{
    patients: any[];
    totalCount: number;
    hasMore: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Debounce the search parameter to prevent excessive fetching
  const [debouncedSearch] = useDebounce(filters.search, 500);

  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getPatients({
        limit: filters.limit || 20,
        offset: filters.offset || 0,
        search: debouncedSearch,
      });

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch patients"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [filters.limit, filters.offset, debouncedSearch]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchPatients,
  };
}

/**
 * Hook to fetch a single patient by ID
 */
export function usePatient(patientId: string | null): PatientHookReturn {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(patientId !== null);
  const [error, setError] = useState<Error | null>(null);

  const fetchPatient = useCallback(async () => {
    if (!patientId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getPatient(patientId);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error(`Failed to fetch patient ${patientId}`),
      );
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchPatient,
  };
}

/**
 * Hook to fetch a patient's calls
 */
export function usePatientCalls(
  patientId: string | null,
  limit: number = 10,
): PatientCallsHookReturn {
  const [data, setData] = useState<{ calls: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(patientId !== null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!patientId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const fetchCalls = async () => {
      try {
        const result = await getPatientCalls(patientId, limit);
        setData({ calls: result });
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error(`Failed to fetch calls for patient ${patientId}`),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchCalls();
  }, [patientId, limit]);

  return {
    data,
    isLoading,
    error,
  };
}

/**
 * Hook to search patients
 */
export function useSearchPatients(
  initialQuery: string = "",
  options: { limit?: number; includeRecentCalls?: boolean } = {},
): SearchPatientsHookReturn {
  const [query, setQuery] = useState<string>(initialQuery);
  const [debouncedQuery] = useDebounce(query, 500);
  const [data, setData] = useState<{ patients: any[]; total: number } | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const search = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setData(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await searchPatients({
          query: debouncedQuery,
          limit: options.limit || 10,
          includeRecentCalls: options.includeRecentCalls,
        });

        setData(result);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to search patients"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedQuery, options.limit, options.includeRecentCalls]);

  return {
    data,
    isLoading,
    error,
    search: setQuery,
  };
}

/**
 * Hook to create a new patient
 */
export function useCreatePatient(): CreatePatientHookReturn {
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async (data: CreatePatientInput): Promise<any> => {
    setIsPending(true);
    setError(null);

    try {
      const result = await createPatient(data);
      return result;
    } catch (err) {
      const thrownError =
        err instanceof Error ? err : new Error("Failed to create patient");
      setError(thrownError);
      throw thrownError;
    } finally {
      setIsPending(false);
    }
  };

  return {
    mutateAsync,
    isPending,
    error,
  };
}
