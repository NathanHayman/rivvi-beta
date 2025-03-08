// src/hooks/campaigns/use-campaign.ts
"use client";

import { Campaign } from "@/components/tables/campaigns-table";
import {
  getAllCampaignsForOrg,
  getCampaignById,
} from "@/server/actions/campaigns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: ["campaign", id],
    queryFn: () => (id ? getCampaignById(id) : null),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCampaigns(initialLimit = 10) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialLimit,
  });

  const query = useQuery({
    queryKey: ["campaigns", pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      return getAllCampaignsForOrg();
    },
  });

  // Transform the data to match the Campaign interface
  const campaigns: Campaign[] = query.data?.success
    ? query.data.data.map((campaign: any) => ({
        id: campaign.id || "",
        name: campaign.name || "",
        direction: campaign.direction || "",
        agentId: campaign.template?.agentId || "",
        createdAt: campaign.createdAt
          ? new Date(campaign.createdAt)
          : new Date(),
        runCount: campaign.runCount || 0,
        callCount: campaign.callCount || 0,
      }))
    : [];

  return {
    ...query,
    campaigns,
    totalCount: campaigns.length,
    pagination,
    setPagination,
  };
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; [key: string]: any }) => {
      // This is a placeholder until updateCampaign is implemented
      toast.error("Campaign update not implemented yet");
      return data;
    },
    onSuccess: (data) => {
      toast.success("Campaign updated successfully");

      // Invalidate affected queries
      queryClient.invalidateQueries({
        queryKey: ["campaign", data.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["campaigns"],
      });

      return data;
    },
    onError: (error) => {
      toast.error(`Failed to update campaign: ${error.message}`);
    },
  });
}
