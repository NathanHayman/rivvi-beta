// src/hooks/organizations/use-organization.ts
import { getOrganizationMembers } from "@/server/actions/organizations/fetch";
import { useCallback, useEffect, useState } from "react";

type MembersHookReturn = {
  data: {
    members: any[];
    totalCount: number;
  } | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

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
