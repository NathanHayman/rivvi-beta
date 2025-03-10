"use client";

import {
  generateCampaignReport,
  getCampaignAnalytics,
} from "@/server/actions/dashboard";
import { useMutation, useQuery } from "@tanstack/react-query";

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

/**
 * Hook for generating a campaign report
 */
export function useGenerateCampaignReport() {
  return useMutation({
    mutationFn: async (campaignId: string) => {
      return generateCampaignReport(campaignId);
    },
  });
}
