// src/server/api/routers/organization.ts
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  orgProcedure,
  protectedProcedure,
  superAdminProcedure,
} from "@/server/api/trpc";
import { organizations, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const organizationRouter = createTRPCRouter({
  // Get the current user's organization
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.auth.orgId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active organization",
      });
    }

    const [organization] = await ctx.db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkId, ctx.auth.orgId));

    if (!organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }

    return organization;
  }),

  // Get all organizations (super admin only)
  getAll: superAdminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;

      const allOrganizations = await ctx.db
        .select()
        .from(organizations)
        .limit(limit)
        .offset(offset)
        .orderBy(organizations.createdAt);

      const totalCount = await ctx.db
        .select({ count: organizations.id })
        .from(organizations)
        .then((rows) => rows.length);

      return {
        organizations: allOrganizations,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    }),

  // Get an organization by ID (super admin only)
  getById: superAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [organization] = await ctx.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.id));

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      return organization;
    }),

  // Create a new organization (super admin only)
  create: superAdminProcedure
    .input(
      z.object({
        clerkId: z.string(),
        name: z.string().min(1),
        phone: z.string().optional(),
        timezone: z.string().optional(),
        officeHours: z
          .object({
            monday: z.object({
              start: z.string(),
              end: z.string(),
            }),
            tuesday: z.object({
              start: z.string(),
              end: z.string(),
            }),
            wednesday: z.object({
              start: z.string(),
              end: z.string(),
            }),
            thursday: z.object({
              start: z.string(),
              end: z.string(),
            }),
            friday: z.object({
              start: z.string(),
              end: z.string(),
            }),
            saturday: z
              .object({
                start: z.string(),
                end: z.string(),
              })
              .nullable()
              .optional(),
            sunday: z
              .object({
                start: z.string(),
                end: z.string(),
              })
              .nullable()
              .optional(),
          })
          .optional(),
        concurrentCallLimit: z.number().min(1).max(100).optional(),
        isSuperAdmin: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if an organization with the same Clerk ID already exists
      const existingOrg = await ctx.db
        .select()
        .from(organizations)
        .where(eq(organizations.clerkId, input.clerkId));

      if (existingOrg.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An organization with this Clerk ID already exists",
        });
      }

      // Normalize officeHours to ensure saturday and sunday are either objects or null
      const officeHours = input.officeHours
        ? {
            ...input.officeHours,
            saturday: input.officeHours.saturday ?? null,
            sunday: input.officeHours.sunday ?? null,
          }
        : undefined;

      // Create the organization
      const [organization] = await ctx.db
        .insert(organizations)
        .values({
          clerkId: input.clerkId,
          name: input.name,
          phone: input.phone,
          timezone: input.timezone,
          officeHours,
          concurrentCallLimit: input.concurrentCallLimit,
          isSuperAdmin: input.isSuperAdmin,
        })
        .returning();

      return organization;
    }),

  // Update an organization (super admin or org admin only)
  update: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        timezone: z.string().optional(),
        officeHours: z
          .object({
            monday: z.object({
              start: z.string(),
              end: z.string(),
            }),
            tuesday: z.object({
              start: z.string(),
              end: z.string(),
            }),
            wednesday: z.object({
              start: z.string(),
              end: z.string(),
            }),
            thursday: z.object({
              start: z.string(),
              end: z.string(),
            }),
            friday: z.object({
              start: z.string(),
              end: z.string(),
            }),
            saturday: z
              .object({
                start: z.string(),
                end: z.string(),
              })
              .nullable()
              .optional(),
            sunday: z
              .object({
                start: z.string(),
                end: z.string(),
              })
              .nullable()
              .optional(),
          })
          .optional(),
        concurrentCallLimit: z.number().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = input.id;

      // Check if the user is a super admin or an admin of the organization
      if (!ctx.auth.isSuperAdmin && ctx.auth.organization?.id !== orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to update this organization",
        });
      }

      // Remove id from input to avoid updating it
      const { id, ...updateData } = input;

      // Normalize officeHours to ensure saturday and sunday are either objects or null
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
      const [updatedOrg] = await ctx.db
        .update(organizations)
        .set(normalizedData)
        .where(eq(organizations.id, orgId))
        .returning();

      if (!updatedOrg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      return updatedOrg;
    }),

  // Get all members of an organization
  getMembers: orgProcedure
    .input(
      z.object({
        organizationId: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;

      // If organizationId is provided and user is super admin, use that
      // Otherwise use the current user's organization
      const orgId =
        ctx.auth.isSuperAdmin && input.organizationId
          ? input.organizationId
          : ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No organization specified",
        });
      }

      const members = await ctx.db
        .select()
        .from(users)
        .where(eq(users.orgId, orgId))
        .limit(limit)
        .offset(offset)
        .orderBy(users.createdAt);

      const totalCount = await ctx.db
        .select({ count: users.id })
        .from(users)
        .where(eq(users.orgId, orgId))
        .then((rows) => rows.length);

      return {
        members,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    }),
});
