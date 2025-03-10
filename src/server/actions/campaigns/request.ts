// src/actions/campaigns/request.ts
"use server";

import { requireOrg, requireSuperAdmin } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import {
  createCampaignRequestSchema,
  processCampaignRequestSchema,
  type ZCreateCampaignRequest,
  type ZProcessCampaignRequest,
} from "@/lib/validation/campaigns";
import { campaignRequestService } from "@/services/campaigns";
import { revalidatePath } from "next/cache";

export async function requestCampaign(data: ZCreateCampaignRequest) {
  const { orgId, userId } = await requireOrg();

  if (!userId) {
    throw new Error("User ID not available");
  }

  console.log("Campaign request data received:", data);

  try {
    // Add required fields before validation
    const completeData = {
      ...data,
      orgId,
      requestedBy: userId,
    };

    const validated = createCampaignRequestSchema.parse(completeData);
    console.log("Validation passed");

    const result = await campaignRequestService.create(validated);

    if (isError(result)) {
      console.error("Campaign request creation error:", result.error);
      throw new Error(result.error.message);
    }

    revalidatePath("/dashboard/campaigns");
    return result.data;
  } catch (error) {
    console.error("Campaign request creation failed:", error);
    throw error;
  }
}

export async function processCampaignRequest(data: ZProcessCampaignRequest) {
  await requireSuperAdmin();

  try {
    const validated = processCampaignRequestSchema.parse(data);

    const result = await campaignRequestService.process(validated);

    if (isError(result)) {
      console.error("Campaign request processing error:", result.error);
      throw new Error(result.error.message);
    }

    revalidatePath("/dashboard/campaigns");
    revalidatePath("/admin/campaign-requests");
    return result.data;
  } catch (error) {
    console.error("Campaign request processing failed:", error);
    throw error;
  }
}

export async function getAllCampaignRequests() {
  const { orgId } = await requireOrg();

  try {
    const result = await campaignRequestService.getAll({
      orgId,
    });

    if (isError(result)) {
      console.error("Error fetching campaign requests:", result.error);
      throw new Error(result.error.message);
    }

    return result.data;
  } catch (error) {
    console.error("Failed to fetch campaign requests:", error);
    throw error;
  }
}

export async function getCampaignRequestById(requestId: string) {
  try {
    const result = await campaignRequestService.getById(requestId);

    if (isError(result)) {
      console.error("Error fetching campaign request:", result.error);
      throw new Error(result.error.message);
    }

    return result.data;
  } catch (error) {
    console.error("Failed to fetch campaign request:", error);
    throw error;
  }
}
