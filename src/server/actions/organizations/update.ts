"use server";

import { requireAuth } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import { updateOrgSchema } from "@/lib/validation/organizations";
import { organizationService } from "@/services/organization";
import { revalidatePath } from "next/cache";

// Define the InviteUserToOrgParams type
interface InviteUserToOrgParams {
  emailAddress: string;
  role: string;
}

// Define the RevokeInvitationParams type
interface RevokeInvitationParams {
  invitationId: string;
}

export async function updateOrganization(data: unknown) {
  try {
    // Get auth context - support both org admin and super admin
    const { orgId } = await requireAuth();

    const validated = updateOrgSchema.parse(data);

    // Check if user is a super admin
    const superAdminResult = await organizationService.isSuperAdmin(orgId);
    const isSuperAdmin = superAdminResult.success
      ? superAdminResult.data
      : false;

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
  } catch (error) {
    console.error("Error in updateOrganization:", error);
    throw error;
  }
}

export async function inviteUserToOrganization(
  input: InviteUserToOrgParams,
): Promise<{
  success: boolean;
  emailAddress?: string;
  role?: string;
}> {
  try {
    // Ensure authenticated user with organization context
    const { orgId } = await requireAuth();

    if (!orgId) {
      throw new Error("No organization context found");
    }

    // Invite the user
    const result = await organizationService.inviteUser({
      organizationId: orgId,
      emailAddress: input.emailAddress,
      role: input.role,
    });

    if (isError(result)) {
      console.error("Clerk invitation error details:", {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
      });
      throw new Error(`Invitation failed: ${result.error.message}`);
    }

    // Revalidate member list
    revalidatePath(`/settings`);

    return {
      success: true,
      emailAddress: input.emailAddress,
      role: input.role,
    };
  } catch (error) {
    console.error("Error inviting user:", error);
    throw error;
  }
}

export async function revokeInvitation(
  input: RevokeInvitationParams,
): Promise<{ success: boolean }> {
  try {
    // Ensure authenticated user with organization context
    const { orgId } = await requireAuth();

    if (!orgId) {
      throw new Error("No organization context found");
    }

    // Revoke the invitation
    const result = await organizationService.revokeInvitation({
      organizationId: orgId,
      invitationId: input.invitationId,
    });

    if (isError(result)) {
      console.error("Clerk revocation error details:", {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
      });
      throw new Error(`Invitation revocation failed: ${result.error.message}`);
    }

    // Revalidate member list
    revalidatePath(`/settings`);

    return { success: true };
  } catch (error) {
    console.error("Error revoking invitation:", error);
    throw error;
  }
}
