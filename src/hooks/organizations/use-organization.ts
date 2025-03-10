// src/hooks/organizations/use-organization.ts
import {
  getCurrentOrganization,
  getOrganizationMembers,
  isSuperAdmin,
} from "@/server/actions/organizations/fetch";
import { updateOrganization } from "@/server/actions/organizations/update";
import { useCallback, useEffect, useState } from "react";

// Define types
type OrganizationHookReturn = {
  data: any | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

type MembersHookReturn = {
  data: {
    members: any[];
    totalCount: number;
  } | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

type UpdateOrganizationInput = {
  id: string;
  name?: string;
  phone?: string;
  timezone?: string;
  officeHours?: any;
  concurrentCallLimit?: number;
};

type UpdateOrganizationHookReturn = {
  mutateAsync: (data: UpdateOrganizationInput) => Promise<any>;
  isPending: boolean;
  error: Error | null;
};

type SuperAdminHookReturn = {
  isSuperAdmin: boolean;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Hook to fetch the current organization
 */
export function useCurrentOrganization(): OrganizationHookReturn {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrganization = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getCurrentOrganization();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch organization"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchOrganization,
  };
}

/**
 * Hook to fetch organization members
 */
export function useOrganizationMembers(
  organizationId?: string,
  limit: number = 20,
  offset: number = 0,
): MembersHookReturn {
  const [data, setData] = useState<{
    members: any[];
    totalCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getOrganizationMembers({
        organizationId,
        limit,
        offset,
      });

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to fetch organization members"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, limit, offset]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchMembers,
  };
}

/**
 * Hook to update an organization
 */
export function useUpdateOrganization(): UpdateOrganizationHookReturn {
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async (data: UpdateOrganizationInput): Promise<any> => {
    setIsPending(true);
    setError(null);

    try {
      const result = await updateOrganization(data);
      return result;
    } catch (err) {
      const thrownError =
        err instanceof Error ? err : new Error("Failed to update organization");
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

/**
 * Hook to check if the current user is a super admin
 */
export function useIsSuperAdmin(): SuperAdminHookReturn {
  const [isSuperAdminState, setIsSuperAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await isSuperAdmin();
        setIsSuperAdmin(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to check super admin status"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    checkSuperAdmin();
  }, []);

  return {
    isSuperAdmin: isSuperAdminState,
    isLoading,
    error,
  };
}
