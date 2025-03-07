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
import { count, eq } from "drizzle-orm";

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

      return createSuccess({
        members,
        totalCount: Number(totalCount),
        hasMore: offset + limit < Number(totalCount),
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
};
