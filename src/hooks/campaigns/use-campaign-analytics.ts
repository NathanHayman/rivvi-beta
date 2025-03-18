"use client";

import { getCampaignAnalytics } from "@/server/actions/dashboard";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook for fetching campaign analytics data
 * @param campaignId The ID of the campaign to get analytics for
 */
export function useCampaignAnalytics(campaignId: string) {
  return useQuery({
    queryKey: ["campaignAnalytics", campaignId],
    queryFn: async () => {
      return getCampaignAnalytics(campaignId);
    },
  });
}
