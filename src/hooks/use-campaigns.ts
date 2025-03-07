// src/hooks/campaigns/use-campaign.ts
"use client";

import { getCampaign, updateCampaign } from "@/server/actions/campaigns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: ["campaign", id],
    queryFn: () => (id ? getCampaign(id) : null),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => updateCampaign(data),
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
