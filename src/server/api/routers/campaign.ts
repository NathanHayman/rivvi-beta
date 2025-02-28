// src/server/api/routers/campaign.ts
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { retell } from "@/lib/retell-client";
import {
  createTRPCRouter,
  orgProcedure,
  superAdminProcedure,
} from "@/server/api/trpc";
import { campaignRequests, campaigns, runs } from "@/server/db/schema";
import { and, desc, eq } from "drizzle-orm";

// Validation schemas
const campaignConfigSchema = z.object({
  basePrompt: z.string(),
  variables: z.object({
    patient: z.object({
      fields: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          possibleColumns: z.array(z.string()),
          transform: z
            .enum(["text", "date", "time", "phone", "provider"])
            .optional(),
          required: z.boolean(),
          description: z.string().optional(),
        }),
      ),
      validation: z.object({
        requireValidPhone: z.boolean(),
        requireValidDOB: z.boolean(),
        requireName: z.boolean(),
      }),
    }),
    campaign: z.object({
      fields: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          possibleColumns: z.array(z.string()),
          transform: z
            .enum(["text", "date", "time", "phone", "provider"])
            .optional(),
          required: z.boolean(),
          description: z.string().optional(),
        }),
      ),
    }),
  }),
  postCall: z.object({
    standard: z.object({
      fields: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          type: z.enum(["boolean", "string", "date", "enum"]),
          options: z.array(z.string()).optional(),
          required: z.boolean(),
          description: z.string().optional(),
        }),
      ),
    }),
    campaign: z.object({
      fields: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          type: z.enum(["boolean", "string", "date", "enum"]),
          options: z.array(z.string()).optional(),
          required: z.boolean(),
          description: z.string().optional(),
          isMainKPI: z.boolean().optional(),
        }),
      ),
    }),
  }),
});

export const campaignRouter = createTRPCRouter({
  // Get all campaigns for the current organization
  getAll: orgProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      const allCampaigns = await ctx.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.orgId, orgId))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(campaigns.createdAt));

      const totalCount = await ctx.db
        .select({ count: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.orgId, orgId))
        .then((rows) => rows.length);

      return {
        campaigns: allCampaigns,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    }),

  // Get a campaign by ID
  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Super admins can view any campaign
      const whereClause = ctx.auth.isSuperAdmin
        ? eq(campaigns.id, input.id)
        : and(eq(campaigns.id, input.id), eq(campaigns.orgId, orgId));

      const [campaign] = await ctx.db
        .select()
        .from(campaigns)
        .where(whereClause);

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      return campaign;
    }),

  // Get recent runs for a campaign
  getRecentRuns: orgProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        limit: z.number().min(1).max(20).optional().default(5),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      const recentRuns = await ctx.db
        .select()
        .from(runs)
        .where(
          and(eq(runs.campaignId, input.campaignId), eq(runs.orgId, orgId)),
        )
        .limit(input.limit)
        .orderBy(desc(runs.createdAt));

      return recentRuns;
    }),

  // Create a campaign (super admin only)
  create: superAdminProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        name: z.string().min(1),
        agentId: z.string().min(1),
        type: z.string().min(1),
        config: campaignConfigSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First, verify the Retell agent ID is valid
      try {
        const agentInfo = await retell.agent.retrieve(input.agentId);
        if (!agentInfo) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid Retell agent ID",
          });
        }
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to verify Retell agent ID",
          cause: error,
        });
      }

      // Create the campaign
      const [campaign] = await ctx.db
        .insert(campaigns)
        .values({
          orgId: input.orgId,
          name: input.name,
          agentId: input.agentId,
          type: input.type,
          config: input.config,
        })
        .returning();

      return campaign;
    }),

  // Update a campaign (super admin only)
  update: superAdminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        agentId: z.string().min(1).optional(),
        type: z.string().min(1).optional(),
        config: campaignConfigSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // If updating the agent ID, verify it's valid
      if (updateData.agentId) {
        try {
          const agentInfo = await retell.agent.retrieve(updateData.agentId);
          if (!agentInfo) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid Retell agent ID",
            });
          }
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Failed to verify Retell agent ID",
            cause: error,
          });
        }
      }

      // Update the campaign
      const [updatedCampaign] = await ctx.db
        .update(campaigns)
        .set(updateData)
        .where(eq(campaigns.id, id))
        .returning();

      if (!updatedCampaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      return updatedCampaign;
    }),

  // Update agent prompt via Retell API
  updateAgentPrompt: superAdminProcedure
    .input(
      z.object({
        agentId: z.string().min(1),
        prompt: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const agent = await retell.agent.retrieve(input.agentId);
        if (!agent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid Retell agent ID",
          });
        }
        const llmId =
          agent.response_engine.type === "retell-llm"
            ? agent.response_engine.llm_id
            : null;
        if (!llmId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid Retell agent ID",
          });
        }
        const result = await retell.llm.update(llmId, {
          general_prompt: input.prompt,
        });

        return { success: true, agent: result };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update agent prompt",
          cause: error,
        });
      }
    }),

  // Request a new campaign (org users)
  requestCampaign: orgProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organization?.id;
      const userId = ctx.auth.userId;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Create the campaign request
      const [campaignRequest] = await ctx.db
        .insert(campaignRequests)
        .values({
          orgId,
          requestedBy: userId,
          name: input.name,
          type: input.type,
          description: input.description,
          status: "pending",
        })
        .returning();

      return campaignRequest;
    }),

  // Get campaign requests for the current organization
  getCampaignRequests: orgProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      const requests = await ctx.db
        .select()
        .from(campaignRequests)
        .where(eq(campaignRequests.orgId, orgId))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(campaignRequests.createdAt));

      const totalCount = await ctx.db
        .select({ count: campaignRequests.id })
        .from(campaignRequests)
        .where(eq(campaignRequests.orgId, orgId))
        .then((rows) => rows.length);

      return {
        requests,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    }),

  // Get all campaign requests (super admin only)
  getAllCampaignRequests: superAdminProcedure
    .input(
      z.object({
        status: z
          .enum(["pending", "approved", "rejected", "completed"])
          .optional(),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, status } = input;

      // Build the query conditions
      const whereConditions = [];
      if (status) {
        whereConditions.push(eq(campaignRequests.status, status));
      }

      // Execute the query with or without the where clause
      const requests =
        whereConditions.length > 0
          ? await ctx.db
              .select()
              .from(campaignRequests)
              .where(and(...whereConditions))
              .limit(limit)
              .offset(offset)
              .orderBy(desc(campaignRequests.createdAt))
          : await ctx.db
              .select()
              .from(campaignRequests)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(campaignRequests.createdAt));

      // Count query with the same conditions
      const totalCount =
        whereConditions.length > 0
          ? await ctx.db
              .select({ count: campaignRequests.id })
              .from(campaignRequests)
              .where(and(...whereConditions))
              .then((rows) => rows.length)
          : await ctx.db
              .select({ count: campaignRequests.id })
              .from(campaignRequests)
              .then((rows) => rows.length);

      return {
        requests,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    }),

  // Process a campaign request (super admin only)
  processCampaignRequest: superAdminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        status: z.enum(["approved", "rejected", "completed"]),
        adminNotes: z.string().optional(),
        resultingCampaignId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { requestId, status, adminNotes, resultingCampaignId } = input;

      // Update the campaign request
      const [updatedRequest] = await ctx.db
        .update(campaignRequests)
        .set({
          status,
          adminNotes,
          resultingCampaignId,
        })
        .where(eq(campaignRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign request not found",
        });
      }

      return updatedRequest;
    }),
});
