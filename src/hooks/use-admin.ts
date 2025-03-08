"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

// Placeholder for admin server actions
// These will need to be implemented in src/server/actions/admin/campaigns.ts
const adminActions = {
  getAllCampaigns: async ({
    limit,
    offset,
  }: {
    limit: number;
    offset: number;
  }) => {
    return {
      campaigns: [],
      totalCount: 0,
    };
  },
  deleteCampaign: async ({ campaignId }: { campaignId: string }) => {
    // This is a placeholder until the server action is implemented
    return { success: true };
  },
  getAgents: async () => {
    // This is a placeholder until the server action is implemented
    return [];
  },
  getOrganizationsIdsAndNames: async () => {
    // This is a placeholder until the server action is implemented
    return [];
  },
  createCampaign: async (data: any) => {
    // This is a placeholder until the server action is implemented
    return { id: "new-campaign-id" };
  },
};

export function useAdminCampaigns(initialLimit = 10) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialLimit,
  });
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin", "campaigns", pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      return adminActions.getAllCampaigns({
        limit: pagination.pageSize,
        offset: pagination.pageIndex * pagination.pageSize,
      });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return adminActions.deleteCampaign({ campaignId });
    },
    onSuccess: () => {
      toast.success("Campaign deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete campaign: ${error.message}`);
    },
  });

  return {
    ...query,
    campaigns: query.data?.campaigns || [],
    totalCount: query.data?.totalCount || 0,
    pagination,
    setPagination,
    deleteCampaign: deleteCampaignMutation.mutate,
    isDeleting: deleteCampaignMutation.isPending,
  };
}

export function useAdminAgents() {
  return useQuery({
    queryKey: ["admin", "agents"],
    queryFn: async () => {
      return adminActions.getAgents();
    },
  });
}

export function useAdminOrganizations() {
  return useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: async () => {
      return adminActions.getOrganizationsIdsAndNames();
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      return adminActions.createCampaign(data);
    },
    onSuccess: (data) => {
      toast.success("Campaign created successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      return data;
    },
    onError: (error: Error) => {
      toast.error(`Failed to create campaign: ${error.message}`);
    },
  });
}
