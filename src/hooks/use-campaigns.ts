// src/hooks/use-campaigns.ts
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Hook to fetch and manage campaigns
 */
export function useCampaigns(initialLimit = 10) {
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialLimit,
  });

  // Get all campaigns with pagination
  const {
    data: campaignsData,
    isLoading: isLoadingCampaigns,
    error: campaignsError,
    refetch: refetchCampaigns,
  } = api.campaign.getAll.useQuery({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    search: searchTerm.length >= 3 ? searchTerm : undefined,
  });

  // Mutation to request a new campaign
  const requestCampaignMutation = api.campaign.requestCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campaign request submitted successfully");
      refetchCampaigns();
    },
    onError: (error) => {
      toast.error(`Error requesting campaign: ${error.message}`);
    },
  });

  // Submit a campaign request
  const requestCampaign = async (data: {
    name: string;
    type: string;
    description: string;
  }) => {
    try {
      await requestCampaignMutation.mutateAsync(data);
      return true;
    } catch (error) {
      return false;
    }
  };

  // Get campaign requests for the current organization
  const {
    data: requestsData,
    isLoading: isLoadingRequests,
    refetch: refetchRequests,
  } = api.campaign.getCampaignRequests.useQuery(
    { limit: initialLimit },
    { enabled: false },
  );

  return {
    campaigns: campaignsData?.campaigns || [],
    totalCampaigns: campaignsData?.totalCount || 0,
    isLoadingCampaigns,
    campaignsError,
    refetchCampaigns,
    searchTerm,
    setSearchTerm,
    pagination,
    setPagination,
    hasMore: campaignsData?.hasMore || false,

    requests: requestsData?.requests || [],
    totalRequests: requestsData?.totalCount || 0,
    isLoadingRequests,
    refetchRequests,

    requestCampaign,
    isRequestingCampaign: requestCampaignMutation.isPending,
  };
}

/**
 * Hook to fetch and manage a single campaign
 */
export function useCampaign(campaignId: string) {
  const router = useRouter();
  const utils = api.useUtils();

  // Get campaign details
  const {
    data: campaign,
    isLoading,
    error,
  } = api.campaign.getById.useQuery(
    { id: campaignId },
    {
      enabled: !!campaignId,
      refetchOnWindowFocus: false,
    },
  );

  // Get recent runs for this campaign
  const { data: recentRuns, isLoading: isLoadingRuns } =
    api.campaign.getRecentRuns.useQuery(
      { campaignId, limit: 5 },
      { enabled: !!campaignId, refetchOnWindowFocus: false },
    );

  // Create run mutation
  const createRunMutation = api.run.create.useMutation({
    onSuccess: (data) => {
      toast.success("Run created successfully");
      router.push(`/campaigns/${campaignId}/runs/${data?.id}`);
    },
    onError: (error) => {
      toast.error(`Error creating run: ${error.message}`);
    },
  });

  const createRun = async (data: { name: string; scheduledAt?: string }) => {
    try {
      await createRunMutation.mutateAsync({
        campaignId,
        ...data,
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  return {
    campaign,
    isLoading,
    error,
    recentRuns: recentRuns || [],
    isLoadingRuns,
    createRun,
    isCreatingRun: createRunMutation.isPending,
    refetch: () => {
      utils.campaign.getById.invalidate({ id: campaignId });
      utils.campaign.getRecentRuns.invalidate({ campaignId });
    },
  };
}
