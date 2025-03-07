"use server";

import { requireAuth } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import { updateOrgSchema } from "@/lib/validation/organizations";
import { organizationService } from "@/services/organization";
import { revalidatePath } from "next/cache";

export async function updateOrganization(data: unknown) {
  // Get auth context - support both org admin and super admin
  const { orgId, isSuperAdmin } = await requireAuth();

  const validated = updateOrgSchema.parse(data);

  // Check if user can update this organization
  if (!isSuperAdmin && orgId !== validated.id) {
    throw new Error("You do not have permission to update this organization");
  }

  const result = await organizationService.update(validated);

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  // Revalidate organization pages
  revalidatePath(`/settings/organization`);

  if (isSuperAdmin) {
    revalidatePath(`/admin/organizations/${validated.id}`);
    revalidatePath(`/admin/organizations`);
  }

  return result.data;
}
