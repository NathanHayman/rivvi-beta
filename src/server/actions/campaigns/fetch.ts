// src/actions/campaigns/fetch.ts
"use server";

import { requireOrg } from "@/lib/auth";
import { isError, ServiceResult } from "@/lib/service-result";
import { getCampaignSchema } from "@/lib/validation/campaigns";
import { campaignsService } from "@/services/campaigns";
import { ZCampaign, ZCampaignWithTemplate } from "@/types/zod";

/**
 * @name getCampaignById
 * @description Gets a campaign by its ID (still based on the current organization)
 * @param {string} id - The ID of the campaign to get
 * @returns {Promise<TGetCampaign | null>}
 */
export async function getCampaignById(
  id: string,
): Promise<ZCampaignWithTemplate | null> {
  const { orgId } = await requireOrg();
  const validated = getCampaignSchema.parse({ id });

  const result = await campaignsService.getById(validated.id, orgId);

  if (isError(result)) {
    if (result.error.code === "NOT_FOUND") {
      return null;
    }
    throw new Error(result.error.message);
  }

  // Use type assertion to access the extended properties
  const typedCampaign = result.data.campaign as typeof result.data.campaign & {
    runCount?: number;
    callCount?: number;
  };

  // Add type verification for the returned campaign data
  console.log("Campaign data for ID:", id, {
    runCount: typedCampaign.runCount,
    runCountType: typeof typedCampaign.runCount,
    callCount: typedCampaign.callCount,
    callCountType: typeof typedCampaign.callCount,
  });

  return result.data;
}

/**
 * @name getAllCampaignsForOrg
 * @description Gets all the campaigns for the current organization
 * @returns {Promise<ServiceResult<TGetCampaign[]>>}
 */
export async function getAllCampaignsForOrg(): Promise<
  ServiceResult<ZCampaign[]>
> {
  const { orgId } = await requireOrg();
  console.log("Fetching campaigns for org:", orgId);

  const result = await campaignsService.getAllByOrgId(orgId);

  // Add debug logging to see what data is being returned
  if (!isError(result)) {
    // Log the data with type information
    console.log(
      "Server-side campaigns data:",
      JSON.stringify(
        result.data.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          runCount: (
            campaign as ZCampaign & { runCount?: number | string | null }
          ).runCount,
          runCountType: typeof (
            campaign as ZCampaign & { runCount?: number | string | null }
          ).runCount,
          callCount: (
            campaign as ZCampaign & { callCount?: number | string | null }
          ).callCount,
          callCountType: typeof (
            campaign as ZCampaign & { callCount?: number | string | null }
          ).callCount,
          rawCampaign: campaign,
        })),
        null,
        2,
      ),
    );

    // Additional check to ensure numbers are properly formatted
    // If they aren't, convert them explicitly one more time
    result.data = result.data.map((campaign) => {
      // Use type assertion to handle the extended properties
      const typedCampaign = campaign as ZCampaign & {
        runCount?: number | string | null;
        callCount?: number | string | null;
      };

      // Log the raw campaign data for debugging
      console.log(`Raw campaign data for ${campaign.id}:`, {
        campaign,
        typedCampaign,
        runCountRaw: typedCampaign.runCount,
        runCountType: typeof typedCampaign.runCount,
        callCountRaw: typedCampaign.callCount,
        callCountType: typeof typedCampaign.callCount,
      });

      // Ensure run and call counts are numbers
      const runCount =
        typeof typedCampaign.runCount === "number"
          ? typedCampaign.runCount
          : typeof typedCampaign.runCount === "string" &&
              typedCampaign.runCount !== ""
            ? Number(typedCampaign.runCount)
            : 0;

      const callCount =
        typeof typedCampaign.callCount === "number"
          ? typedCampaign.callCount
          : typeof typedCampaign.callCount === "string" &&
              typedCampaign.callCount !== ""
            ? Number(typedCampaign.callCount)
            : 0;

      if (
        runCount !== typedCampaign.runCount ||
        callCount !== typedCampaign.callCount
      ) {
        console.log(`Converting campaign ${campaign.id} counts:`, {
          runCount: {
            before: typedCampaign.runCount,
            after: runCount,
            type: typeof runCount,
          },
          callCount: {
            before: typedCampaign.callCount,
            after: callCount,
            type: typeof callCount,
          },
        });
      }

      return {
        ...campaign,
        runCount,
        callCount,
      } as ZCampaign & { runCount: number; callCount: number };
    });
  }

  return result;
}
