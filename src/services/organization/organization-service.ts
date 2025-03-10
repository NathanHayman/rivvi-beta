// src/services/organizations/organization-service.ts
import {
  ServiceResult,
  createError,
  createSuccess,
} from "@/lib/service-result";
import { TUpdateOrg } from "@/lib/validation/organizations";
import { db } from "@/server/db";
import { organizations, users } from "@/server/db/schema";
import { Organization, OrganizationMember } from "@/types/api/organizations";
import { createClerkClient } from "@clerk/nextjs/server";
import { count, eq } from "drizzle-orm";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export const organizationService = {
  async getCurrent(orgId: string): Promise<ServiceResult<Organization>> {
    try {
      const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (!organization) {
        return createError("NOT_FOUND", "Organization not found");
      }

      return createSuccess(organization);
    } catch (error) {
      console.error("Error fetching organization:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch organization",
        error,
      );
    }
  },

  async update(data: TUpdateOrg): Promise<ServiceResult<Organization>> {
    try {
      const { id, ...updateData } = data;

      // Normalize officeHours
      const normalizedData = {
        ...updateData,
        officeHours: updateData.officeHours
          ? {
              ...updateData.officeHours,
              saturday: updateData.officeHours.saturday ?? null,
              sunday: updateData.officeHours.sunday ?? null,
            }
          : updateData.officeHours,
      };

      // Update the organization
      const [updatedOrg] = await db
        .update(organizations)
        .set({
          ...normalizedData,
          updatedAt: new Date(),
        } as unknown as Organization)
        .where(eq(organizations.id, id))
        .returning();

      if (!updatedOrg) {
        return createError("NOT_FOUND", "Organization not found");
      }

      return createSuccess(updatedOrg);
    } catch (error) {
      console.error("Error updating organization:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to update organization",
        error,
      );
    }
  },

  async getMembers(options: {
    organizationId: string;
    limit?: number;
    offset?: number;
  }): Promise<
    ServiceResult<{
      members: OrganizationMember[];
      totalCount: number;
      hasMore: boolean;
    }>
  > {
    try {
      const { organizationId, limit = 50, offset = 0 } = options;

      // Fetch members from the database
      const members = await db
        .select()
        .from(users)
        .where(eq(users.orgId, organizationId))
        .limit(limit)
        .offset(offset)
        .orderBy(users.createdAt);

      const [{ value: totalCount }] = await db
        .select({ value: count() })
        .from(users)
        .where(eq(users.orgId, organizationId));

      // Get organization's Clerk ID
      const [organization] = await db
        .select({ clerkId: organizations.clerkId })
        .from(organizations)
        .where(eq(organizations.id, organizationId));

      if (!organization) {
        return createError("NOT_FOUND", "Organization not found");
      }

      // Fetch pending invitations
      const pendingInvitationsResult = await this.getPendingInvitations(
        organization.clerkId,
      );

      if (pendingInvitationsResult.error) {
        console.error(
          "Error fetching pending invitations:",
          pendingInvitationsResult.error,
        );
        // Continue with just the members from the database
      } else {
        // Convert pending invitations to member format and add to members list
        const pendingInvitations = pendingInvitationsResult.data;

        for (const invitation of pendingInvitations) {
          // Extract email and name parts (if available from email)
          const email = invitation.email_address;
          let firstName = "";
          let lastName = "";

          // Try to extract a name from the email if possible (optional enhancement)
          try {
            const emailName = email.split("@")[0];
            const nameParts = emailName.includes(".")
              ? emailName.split(".")
              : [emailName, ""];

            firstName =
              nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
            if (nameParts.length > 1 && nameParts[1]) {
              lastName =
                nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1);
            }
          } catch (e) {
            // If extraction fails, use empty strings
            console.log("Could not extract name from email", e);
          }

          // Add the pending invitation as a member
          members.push({
            id: `invitation_${invitation.id}`, // Use a prefix to identify as invitation
            clerkId: invitation.id, // Use invitation ID as temp clerk ID
            orgId: organizationId,
            email: email,
            firstName: firstName,
            lastName: lastName,
            role: invitation.role === "org:admin" ? "admin" : "member",
            createdAt: new Date(invitation.created_at),
            updatedAt: new Date(invitation.updated_at || invitation.created_at), // Ensure updatedAt is not undefined
            status: "pending", // Add a status field to identify pending invitations
          } as any);
        }
      }

      return createSuccess({
        members,
        totalCount:
          Number(totalCount) + (pendingInvitationsResult.data?.length || 0),
        hasMore:
          offset + limit <
          Number(totalCount) + (pendingInvitationsResult.data?.length || 0),
      });
    } catch (error) {
      console.error("Error fetching organization members:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch organization members",
        error,
      );
    }
  },

  async getPendingInvitations(
    clerkOrgId: string,
  ): Promise<ServiceResult<any[]>> {
    try {
      // Fetch pending invitations from Clerk API
      const pendingInvitations =
        await clerk.organizations.getOrganizationInvitationList({
          organizationId: clerkOrgId,
          status: ["pending"],
        });

      return createSuccess(pendingInvitations.data);
    } catch (error) {
      console.error("Error fetching pending invitations:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch pending invitations",
        error,
      );
    }
  },

  async revokeInvitation(options: {
    organizationId: string;
    invitationId: string;
  }): Promise<ServiceResult<{ success: boolean }>> {
    try {
      const { organizationId, invitationId } = options;

      // Get the organization's clerk ID
      const [organization] = await db
        .select({ clerkId: organizations.clerkId })
        .from(organizations)
        .where(eq(organizations.id, organizationId));

      if (!organization) {
        return createError("NOT_FOUND", "Organization not found");
      }

      console.log("Revoking invitation:", {
        orgId: organizationId,
        clerkOrgId: organization.clerkId,
        invitationId,
      });

      // Revoke the invitation in Clerk
      await clerk.organizations.revokeOrganizationInvitation({
        organizationId: organization.clerkId,
        invitationId: invitationId,
        requestingUserId: process.env.CLERK_BACKEND_API_USER_ID || "system", // Use configured ID or fallback to "system"
      });

      return createSuccess({ success: true });
    } catch (error) {
      console.error("Error revoking invitation:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to revoke invitation",
        error,
      );
    }
  },

  async isSuperAdmin(orgId: string): Promise<ServiceResult<boolean>> {
    try {
      const [organization] = await db
        .select({ isSuperAdmin: organizations.isSuperAdmin })
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (!organization) {
        return createError("NOT_FOUND", "Organization not found");
      }

      return createSuccess(organization.isSuperAdmin);
    } catch (error) {
      console.error("Error checking super admin status:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to check super admin status",
        error,
      );
    }
  },

  async inviteUser(options: {
    organizationId: string;
    emailAddress: string;
    role: string;
  }): Promise<ServiceResult<{ success: boolean }>> {
    try {
      const { organizationId, emailAddress, role } = options;

      // Get the organization's clerk ID
      const [organization] = await db
        .select({ clerkId: organizations.clerkId })
        .from(organizations)
        .where(eq(organizations.id, organizationId));

      if (!organization) {
        return createError("NOT_FOUND", "Organization not found");
      }

      console.log("Inviting user to organization:", {
        orgId: organizationId,
        clerkOrgId: organization.clerkId,
        emailAddress,
        role,
      });

      // Ensure we have a valid redirect URL
      const redirectUrl = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL;
      console.log("Using redirect URL:", redirectUrl);

      // Default to member role if we can't determine the correct mapping
      let clerkRoleKey = "org:member";

      try {
        // First, get the available roles from Clerk for this organization
        const orgDetails = await clerk.organizations.getOrganization({
          organizationId: organization.clerkId,
        });

        console.log("Organization details:", orgDetails);

        // Try to map our role to an available Clerk role
        if (role === "admin" || role === "superadmin") {
          clerkRoleKey = "org:admin";
        }

        console.log("Using Clerk role key:", clerkRoleKey);

        // Create the invitation in Clerk
        await clerk.organizations.createOrganizationInvitation({
          organizationId: organization.clerkId,
          emailAddress,
          role: clerkRoleKey,
          // Only include redirectUrl if it's a valid URL
          ...(redirectUrl && redirectUrl.startsWith("http")
            ? { redirectUrl }
            : {}),
        });
      } catch (clerkError) {
        console.error("Clerk API error:", clerkError);

        // Check for specific Clerk error types and provide better error messages
        let errorMessage = "Failed to invite user through Clerk";

        if (
          clerkError &&
          typeof clerkError === "object" &&
          "errors" in clerkError
        ) {
          const errors = (clerkError as any).errors;
          if (Array.isArray(errors) && errors.length > 0) {
            // Extract detailed error information
            const errorDetails = errors
              .map(
                (err: any) => err.longMessage || err.message || "Unknown error",
              )
              .join("; ");

            errorMessage = `Clerk API error: ${errorDetails}`;
            console.log("Detailed Clerk error:", errors);
          }
        }

        // Check if we should try to add user directly if they already exist
        try {
          // Find existing user by email
          const existingUser = await clerk.users.getUserList({
            emailAddress: [emailAddress],
          });

          if (existingUser.data.length > 0) {
            const userId = existingUser.data[0].id;
            console.log(
              `User ${emailAddress} already exists with ID ${userId}, adding to organization directly`,
            );

            // Add user to organization directly
            try {
              await clerk.organizations.createOrganizationMembership({
                organizationId: organization.clerkId,
                userId: userId,
                role: clerkRoleKey,
              });
              console.log(
                `Successfully added user ${userId} to organization with role ${clerkRoleKey}`,
              );
              return createSuccess({ success: true });
            } catch (membershipError) {
              console.error(
                "Failed to create organization membership:",
                membershipError,
              );
              return createError(
                "INTERNAL_ERROR",
                `Failed to add user to organization: ${membershipError instanceof Error ? membershipError.message : "Unknown error"}`,
                membershipError,
              );
            }
          }
        } catch (secondaryError) {
          console.error("Failed to add existing user:", secondaryError);
        }

        // If we couldn't add directly, throw the original error
        return createError("INTERNAL_ERROR", errorMessage, clerkError);
      }

      return createSuccess({ success: true });
    } catch (error) {
      console.error("Error inviting user:", error);
      return createError("INTERNAL_ERROR", "Failed to invite user", error);
    }
  },
};
