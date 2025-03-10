"use server";

import {
  createError,
  createSuccess,
  isError,
  ServiceResult,
} from "@/lib/service-result";

import { requireSuperAdmin } from "@/lib/auth";
import { adminService } from "@/services/admin";
import { TCampaign } from "@/types/db";
import { ZCampaign, ZCampaignWithTemplate } from "@/types/zod";

export async function getCampaignByIdAdmin(
  id: string,
): Promise<ServiceResult<ZCampaignWithTemplate>> {
  const { isSuperAdmin } = await requireSuperAdmin();
  if (!isSuperAdmin) {
    return createError(
      "UNAUTHORIZED",
      "You are not authorized to access this resource",
    );
  }
  return adminService.campaigns.getById(id);
}

export async function getAllCampaignsAdmin(): Promise<
  ServiceResult<ZCampaign[]>
> {
  const { isSuperAdmin } = await requireSuperAdmin();
  if (!isSuperAdmin) {
    return createError(
      "UNAUTHORIZED",
      "You are not authorized to access this resource",
    );
  }

  const result = await adminService.campaigns.getAll();

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return createSuccess(result.data);
}

export async function deleteCampaignAdmin(
  id: string,
): Promise<ServiceResult<void>> {
  const { isSuperAdmin } = await requireSuperAdmin();
  if (!isSuperAdmin) {
    return createError(
      "UNAUTHORIZED",
      "You are not authorized to access this resource",
    );
  }

  const result = await adminService.campaigns.delete(id);

  if (isError(result)) {
    throw new Error(result.error.message);
  }
  return createSuccess(result.data);
}

export async function createCampaignAdmin(
  campaign: ZCampaign,
): Promise<ServiceResult<ZCampaign>> {
  const { isSuperAdmin } = await requireSuperAdmin();
  if (!isSuperAdmin) {
    return createError(
      "UNAUTHORIZED",
      "You are not authorized to access this resource",
    );
  }
  const result = await adminService.campaigns.create(campaign as TCampaign);

  if (isError(result)) {
    throw new Error(result.error.message);
  }
  return createSuccess(result.data);
}

export async function updateCampaignAdmin(
  id: string,
  campaign: ZCampaign,
): Promise<ServiceResult<ZCampaign>> {
  const { isSuperAdmin } = await requireSuperAdmin();

  if (!isSuperAdmin) {
    return createError(
      "UNAUTHORIZED",
      "You are not authorized to access this resource",
    );
  }
  const result = await adminService.campaigns.update(id, campaign);

  if (isError(result)) {
    throw new Error(result.error.message);
  }
  return createSuccess(result.data);
}

export async function getAllCampaignRequestsAdmin() {
  const { isSuperAdmin } = await requireSuperAdmin();
  if (!isSuperAdmin) {
    throw new Error("You are not authorized to access this resource");
  }

  try {
    const result = await adminService.campaigns.getAllCampaignRequests();

    if (isError(result)) {
      throw new Error(
        result.error?.message || "Failed to fetch campaign requests",
      );
    }

    return result.data;
  } catch (error) {
    console.error("Error fetching all campaign requests:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to fetch campaign requests",
    );
  }
}
