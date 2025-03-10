// src/hooks/campaigns/use-campaign-requests.ts
"use client";

import { getAllCampaignRequests } from "@/server/actions/campaigns";
import { requestCampaign } from "@/server/actions/campaigns/request";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCampaignRequests(params = {}) {
  return useQuery({
    queryKey: ["campaign-requests", params],
    queryFn: () => getAllCampaignRequests(),
    staleTime: 60 * 1000,
  });
}

export function useRequestCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => requestCampaign(data),
    onSuccess: (data) => {
      toast.success("Campaign request submitted successfully");

      // Invalidate affected queries
      queryClient.invalidateQueries({
        queryKey: ["campaign-requests"],
      });

      return data;
    },
    onError: (error) => {
      toast.error(`Failed to submit request: ${error.message}`);
    },
  });
}
