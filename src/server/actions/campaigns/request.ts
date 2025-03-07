// src/actions/campaigns/request.ts
"use server";

import { requireOrg, requireSuperAdmin } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import {
  createCampaignRequestSchema,
  processCampaignRequestSchema,
  type TCreateCampaignRequest,
  type TProcessCampaignRequest,
} from "@/lib/validation/campaigns";
import { campaignRequestService } from "@/services/campaigns";
import { revalidatePath } from "next/cache";

export async function requestCampaign(data: TCreateCampaignRequest) {
  const { orgId, userId } = await requireOrg();

  if (!userId) {
    throw new Error("User ID not available");
  }

  const validated = createCampaignRequestSchema.parse(data);

  const result = await campaignRequestService.create({
    ...validated,
    orgId,
    requestedBy: userId,
  });

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  // Revalidate requests page
  revalidatePath("/campaigns/requests");

  return result.data;
}

export async function processCampaignRequest(data: TProcessCampaignRequest) {
  await requireSuperAdmin();

  const validated = processCampaignRequestSchema.parse(data);

  // Ensure required fields are present
  if (!validated.requestId) {
    throw new Error("Request ID is required");
  }

  const result = await campaignRequestService.process({
    requestId: validated.requestId,
    status: validated.status,
    ...(validated.adminNotes && { adminNotes: validated.adminNotes }),
    ...(validated.resultingCampaignId && {
      resultingCampaignId: validated.resultingCampaignId,
    }),
  });

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  // Revalidate paths
  revalidatePath("/admin/campaign-requests");
  revalidatePath("/campaigns/requests");

  return result.data;
}
