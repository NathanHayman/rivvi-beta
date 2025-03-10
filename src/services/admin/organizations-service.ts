// src/services/admin/organizations-service.ts
import {
  ServiceResult,
  createError,
  createSuccess,
} from "@/lib/service-result";
import { type TCreateOrganization } from "@/lib/validation/admin";
import { db } from "@/server/db";
import { calls, campaigns, organizations, runs } from "@/server/db/schema";
import { and, count, eq, like, or } from "drizzle-orm";

export const organizationsService = {
  async getAll(options: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<
    ServiceResult<{
      organizations: Array<
        typeof organizations.$inferSelect & {
          campaignCount: number;
          runCount: number;
          callCount: number;
        }
      >;
      totalCount: number;
      hasMore: boolean;
    }>
  > {
    try {
      const { limit = 50, offset = 0, search } = options;

      // Build where conditions
      let whereCondition = eq(organizations.isSuperAdmin, false);

      // Add search if provided
      if (search && search.trim() !== "") {
        const searchTerm = `%${search.trim()}%`;
        whereCondition = and(
          whereCondition,
          or(
            like(organizations.name, searchTerm),
            like(organizations.id, searchTerm),
            like(organizations.phone, searchTerm),
          ),
        );
      }

      // Execute query with stats
      const results = await db
        .select({
          org: organizations,
          campaignCount: count(campaigns.id),
          runCount: count(runs.id),
          callCount: count(calls.id),
        })
        .from(organizations)
        .leftJoin(campaigns, eq(organizations.id, campaigns.orgId))
        .leftJoin(runs, eq(organizations.id, runs.orgId))
        .leftJoin(calls, eq(organizations.id, calls.orgId))
        .where(whereCondition)
        .groupBy(organizations.id)
        .limit(limit)
        .offset(offset)
        .orderBy(organizations.createdAt);

      // Count total organizations
      const [{ value: totalCount }] = await db
        .select({ value: count() })
        .from(organizations)
        .where(whereCondition);

      // Format results
      const orgsWithStats = results.map(
        ({ org, campaignCount, runCount, callCount }) => ({
          ...org,
          campaignCount: Number(campaignCount),
          runCount: Number(runCount),
          callCount: Number(callCount),
        }),
      );

      return createSuccess({
        organizations: orgsWithStats,
        totalCount: Number(totalCount),
        hasMore: offset + limit < Number(totalCount),
      });
    } catch (error) {
      console.error("Error fetching organizations:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch organizations",
        error,
      );
    }
  },

  async create(
    data: TCreateOrganization,
  ): Promise<ServiceResult<typeof organizations.$inferSelect>> {
    try {
      // Check if org with same Clerk ID already exists
      const existingOrg = await db
        .select()
        .from(organizations)
        .where(eq(organizations.clerkId, data.clerkId))
        .limit(1);

      if (existingOrg.length > 0) {
        return createError(
          "CONFLICT",
          "An organization with this Clerk ID already exists",
        );
      }

      // Normalize officeHours
      const officeHours = data.officeHours
        ? {
            ...data.officeHours,
            saturday: data.officeHours.saturday ?? null,
            sunday: data.officeHours.sunday ?? null,
          }
        : undefined;

      // Create the organization
      const [organization] = await db
        .insert(organizations)
        .values({
          clerkId: data.clerkId,
          name: data.name,
          phone: data.phone,
          timezone: data.timezone,
          officeHours,
          concurrentCallLimit: data.concurrentCallLimit,
          isSuperAdmin: data.isSuperAdmin,
        } as typeof organizations.$inferInsert)
        .returning();

      if (!organization) {
        return createError("INTERNAL_ERROR", "Failed to create organization");
      }

      return createSuccess(organization);
    } catch (error) {
      console.error("Error creating organization:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to create organization",
        error,
      );
    }
  },

  async getById(
    id: string,
  ): Promise<ServiceResult<typeof organizations.$inferSelect>> {
    try {
      const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

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
};
