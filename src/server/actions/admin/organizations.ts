// src/actions/admin/organizations.ts
"use server";

import { requireSuperAdmin } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import {
  createOrganizationSchema,
  getOrganizationsSchema,
  type TCreateOrganization,
  type TGetOrganizations,
} from "@/lib/validation/admin";
import { adminService } from "@/services/admin";
import { revalidatePath } from "next/cache";

export async function getOrganizations(params: TGetOrganizations) {
  await requireSuperAdmin();

  const validated = getOrganizationsSchema.parse(params);

  const result = await adminService.organizations.getAll(validated);

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function createOrganization(data: TCreateOrganization) {
  await requireSuperAdmin();

  const validated = createOrganizationSchema.parse(data);

  const result = await adminService.organizations.create(validated);

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  // Revalidate organization pages
  revalidatePath("/admin/organizations");

  return result.data;
}
