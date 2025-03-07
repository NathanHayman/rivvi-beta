// src/actions/campaigns/fetch.ts
"use server";

import { requireOrg } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import { getCampaignSchema } from "@/lib/validation/campaigns";
import { campaignsService } from "@/services/campaigns";

// Get campaign by ID action
export async function getCampaign(id: string) {
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
