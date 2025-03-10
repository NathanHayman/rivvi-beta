// src/hooks/campaigns/use-campaigns.ts
import { isError } from "@/lib/service-result";
import {
  getAllCampaignsForOrg,
  getCampaignById,
} from "@/server/actions/campaigns/fetch";
import { requestCampaign } from "@/server/actions/campaigns/request";
import { useCallback, useEffect, useState } from "react";

// Define types
type CampaignHookReturn = {
  data: any | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

type CampaignsHookReturn = {
  data: any[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

type RequestCampaignInput = {
  name: string;
  description: string;
  mainGoal?: string;
  desiredAnalysis?: string[];
  exampleSheets?: Array<{
    name: string;
    url: string;
    fileType: string;
  }>;
  direction?: "inbound" | "outbound";
};

type RequestCampaignHookReturn = {
  mutateAsync: (data: RequestCampaignInput) => Promise<any>;
  isPending: boolean;
  error: Error | null;
};

/**
 * Hook to fetch a single campaign by ID
 */
export function useCampaign(campaignId: string | null): CampaignHookReturn {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(campaignId !== null);
  const [error, setError] = useState<Error | null>(null);

  const fetchCampaign = useCallback(async () => {
    if (!campaignId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getCampaignById(campaignId);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error(`Failed to fetch campaign ${campaignId}`),
      );
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchCampaign,
  };
}

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
 * Hook to request a new campaign
 */
export function useRequestCampaign(): RequestCampaignHookReturn {
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async (data: RequestCampaignInput): Promise<any> => {
    setIsPending(true);
    setError(null);

    try {
      const result = await requestCampaign(data);
      return result;
    } catch (err) {
      const thrownError =
        err instanceof Error ? err : new Error("Failed to request campaign");
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
