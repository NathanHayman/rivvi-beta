// src/actions/organizations/fetch.ts
"use server";

import { requireAuth, requireOrg } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import {
  getMembersSchema,
  type TGetMembers,
} from "@/lib/validation/organizations";
import { organizationService } from "@/services/organization";

export async function getCurrentOrganization() {
  const { orgId } = await requireOrg();

  const result = await organizationService.getCurrent(orgId);

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function isSuperAdmin() {
  const { orgId } = await requireAuth();

  if (!orgId) {
    return false;
  }

  const result = await organizationService.isSuperAdmin(orgId);

  if (!result.success) {
    return false;
  }

  return result.data;
}

export async function getOrganizationMembers(params: TGetMembers) {
  const { orgId, isSuperAdmin } = await requireAuth();

  const validated = getMembersSchema.parse(params);

  // If organizationId is provided and user is super admin, use that
  // Otherwise use the current user's organization
  const organizationId =
    isSuperAdmin && validated.organizationId ? validated.organizationId : orgId;

  if (!organizationId) {
    throw new Error("No organization specified");
  }

  const result = await organizationService.getMembers({
    organizationId,
    limit: validated.limit,
    offset: validated.offset,
  });

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return result.data;
}
