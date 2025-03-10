"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { isError } from "@/lib/service-result";
import {
  createCampaignAdmin,
  deleteCampaignAdmin,
  getAllCampaignsAdmin,
} from "@/server/actions/admin";
import { getOrganizationsIdsAndNames } from "@/server/actions/admin/organizations";

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
    const result = await getAllCampaignsAdmin();
    if (isError(result)) {
      throw new Error(result.error.message);
    }
    return result.data;
  },
  deleteCampaign: async ({ campaignId }: { campaignId: string }) => {
    return deleteCampaignAdmin(campaignId);
  },
  getAgents: async () => {
    const response = await fetch("/api/retell/agents");
    if (!response.ok) {
      throw new Error(`Failed to fetch agents: ${response.statusText}`);
    }
    return response.json();
  },
  getOrganizationsIdsAndNames: async () => {
    return getOrganizationsIdsAndNames();
  },
  createCampaign: async (data: any) => {
    return createCampaignAdmin(data);
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
    campaigns: query.data || [],
    totalCount: query.data?.length || 0,
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
