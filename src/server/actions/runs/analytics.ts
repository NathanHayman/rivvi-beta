"use server";

import { requireOrg } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import { analyticsService } from "@/services/analytics/analytics-service";

/**
 * Get dashboard analytics for the current organization
 */
export async function getDashboardStats() {
  try {
    const { orgId } = await requireOrg();
    const result = await analyticsService.getDashboardStats(orgId);

    if (isError(result)) {
      throw new Error(result.error.message);
    }

    return result.data;
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    throw error;
  }
}

/**
 * Get campaign analytics by campaign ID
 */
export async function getCampaignAnalytics(campaignId: string) {
  try {
    await requireOrg();
    const result = await analyticsService.getCampaignAnalytics(campaignId);

    if (!result) {
      console.error("Analytics service returned undefined result");
      throw new Error("Failed to fetch campaign analytics");
    }

    if (isError(result)) {
      throw new Error(result.error.message);
    }

    return result.data;
  } catch (error) {
    console.error("Error fetching campaign analytics:", error);
    throw error;
  }
}

/**
 * Get run analytics by run ID
 */
export async function getRunAnalytics(runId: string) {
  try {
    await requireOrg();
    const result = await analyticsService.getRunAnalytics(runId);

    if (isError(result)) {
      throw new Error(result.error.message);
    }

    return result.data;
  } catch (error) {
    console.error("Error fetching run analytics:", error);
    throw error;
  }
}
