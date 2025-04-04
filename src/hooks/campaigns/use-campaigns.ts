// src/hooks/campaigns/use-campaigns.ts
import { isError } from "@/lib/service-result";
import { updateCampaignAdmin } from "@/server/actions/admin";
import { getAllCampaignsForOrg } from "@/server/actions/campaigns/fetch";
import { ZCampaignTemplate } from "@/types/zod";
import { useCallback, useEffect, useState } from "react";

type CampaignsHookReturn = {
  data: any[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

type UpdateCampaignInput = {
  id: string;
  name: string;
  description: string;
  direction: "inbound" | "outbound";
  basePrompt: string;
  voicemailMessage: string;
  variablesConfig: ZCampaignTemplate["variablesConfig"];
  analysisConfig: ZCampaignTemplate["analysisConfig"];
  isActive: boolean;
};

type UpdateCampaignHookReturn = {
  mutateAsync: (data: UpdateCampaignInput) => Promise<any>;
  isPending: boolean;
  error: Error | null;
};

/**
 * Hook to fetch all campaigns for the current organization
 */
export function useCampaigns(): CampaignsHookReturn {
  const [data, setData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getAllCampaignsForOrg();
      if (isError(result)) {
        throw new Error(result.error.message);
      }
      setData(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch campaigns"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchCampaigns,
  };
}

/**
 * Hook to update a campaign
 */
export function useUpdateCampaign(): UpdateCampaignHookReturn {
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async (data: UpdateCampaignInput): Promise<any> => {
    setIsPending(true);
    setError(null);

    try {
      const result = await updateCampaignAdmin(data.id, data);
      return result;
    } catch (err) {
      const thrownError =
        err instanceof Error ? err : new Error("Failed to update campaign");
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
