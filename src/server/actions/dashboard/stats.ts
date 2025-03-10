// src/actions/dashboard/stats.ts
"use server";

import { requireOrg } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import { analyticsService } from "@/services/dashboard";

export async function getDashboardStats() {
  const { orgId } = await requireOrg();

  const result = await analyticsService.getDashboardStats(orgId);

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return result.data;
}
