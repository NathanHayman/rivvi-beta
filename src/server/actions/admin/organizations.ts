// src/actions/admin/organizations.ts
"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import {
  createOrganizationSchema,
  getOrganizationsSchema,
  type TCreateOrganization,
  type TGetOrganizations,
} from "@/lib/validation/admin";
import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";
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

export async function getOrganizationsIdsAndNames() {
  await requireSuperAdmin();

  try {
    const orgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
      })
      .from(organizations);

    return orgs;
  } catch (error) {
    console.error("Error fetching organization IDs and names:", error);
    throw new Error("Failed to fetch organizations");
  }
}

export async function getOrganization(id: string) {
  await requireSuperAdmin();

  const result = await adminService.organizations.getById(id);

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
