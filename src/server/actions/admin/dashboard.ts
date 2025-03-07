// src/actions/admin/dashboard.ts
"use server";

import { requireSuperAdmin } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import { adminService } from "@/services/admin";

export async function getDashboardStats() {
  await requireSuperAdmin();

  const result = await adminService.dashboard.getStats();

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function getRecentCalls(params = { limit: 10 }) {
  await requireSuperAdmin();

  const result = await adminService.dashboard.getRecentCalls(params);

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return result.data;
}
