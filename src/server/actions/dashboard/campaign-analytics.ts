"use server";

import { requireOrg } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import { db } from "@/server/db";
import { CallAnalytics } from "@/services/calls/calls-analytics";

/**
 * Get analytics data for a specific campaign
 * @param campaignId The ID of the campaign to get analytics for
 * @returns Campaign analytics data including call metrics, conversion metrics, and run metrics
 */
export async function getCampaignAnalytics(campaignId: string) {
  const { orgId } = await requireOrg();

  // Create an instance of the CallAnalytics service
  const callAnalytics = new CallAnalytics(db);

  try {
    // Get campaign analytics data
    const result = await callAnalytics.getCampaignAnalytics(campaignId);

    if (isError(result)) {
      throw new Error(result.error.message);
    }

    return result.data;
  } catch (error) {
    console.error("Error getting campaign analytics:", error);
    throw new Error("Failed to get campaign analytics");
  }
}

/**
 * Generate a report for a campaign
 * @param campaignId The ID of the campaign to generate a report for
 * @returns Report data in a format that can be converted to CSV
 */
export async function generateCampaignReport(campaignId: string) {
  const { orgId } = await requireOrg();

  // Create an instance of the CallAnalytics service
  const callAnalytics = new CallAnalytics(db);

  try {
    // Get campaign analytics data
    const result = await callAnalytics.getCampaignAnalytics(campaignId);

    if (isError(result)) {
      throw new Error(result.error.message);
    }

    // Format the data for CSV export
    // This is a simplified example - you would need to format the data according to your needs
    const reportData = {
      callMetrics: result.data.callMetrics,
      conversionMetrics: result.data.conversionMetrics,
      runMetrics: result.data.runMetrics,
    };

    return reportData;
  } catch (error) {
    console.error("Error generating campaign report:", error);
    throw new Error("Failed to generate campaign report");
  }
}
