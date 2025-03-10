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
  return campaignsService.getAllByOrgId(orgId);
}
