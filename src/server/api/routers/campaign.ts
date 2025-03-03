// src/server/api/routers/campaign.ts
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { retell } from "@/lib/retell/retell-client";
import {
  createTRPCRouter,
  orgProcedure,
  superAdminProcedure,
} from "@/server/api/trpc";
import {
  CallDirection,
  campaignRequests,
  campaignTemplates,
  campaigns,
  runs,
} from "@/server/db/schema";
import { and, desc, eq } from "drizzle-orm";

// Validation schemas
const templateConfigSchema = z.object({
  variablesConfig: z.object({
    patient: z.object({
      fields: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          possibleColumns: z.array(z.string()),
          transform: z
            .enum([
              "text",
              "short_date",
              "long_date",
              "time",
              "phone",
              "provider",
            ])
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
            .enum([
              "text",
              "short_date",
              "long_date",
              "time",
              "phone",
              "provider",
            ])
            .optional(),
          required: z.boolean(),
          description: z.string().optional(),
        }),
      ),
    }),
  }),
  analysisConfig: z.object({
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

// Helper function to get a campaign with its template
async function getCampaignWithTemplate(
  db: any,
  campaignId: string,
  orgId?: string,
) {
  // Base query to get campaign
  const query = db.select().from(campaigns).where(eq(campaigns.id, campaignId));

  // Add organization filter if provided
  if (orgId) {
    query.where(and(eq(campaigns.id, campaignId), eq(campaigns.orgId, orgId)));
  }

  const [campaign] = await query;

  if (!campaign) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Campaign not found",
    });
  }

  // Get the template
  const [template] = await db
    .select()
    .from(campaignTemplates)
    .where(eq(campaignTemplates.id, campaign.templateId));

  if (!template) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Campaign template not found",
    });
  }

  // Return combined data
  return {
    ...campaign,
    config: {
      basePrompt: template.basePrompt,
      voicemailMessage: template.voicemailMessage,
      variables: template.variablesConfig,
      analysis: template.analysisConfig,
    },
  };
}

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
      const orgId = ctx.auth.orgId;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Get all campaigns for this organization
      const allCampaigns = await ctx.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.orgId, orgId))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(campaigns.createdAt));

      // Also get their templates
      const campaignsWithTemplates = await Promise.all(
        allCampaigns.map(async (campaign) => {
          const [template] = await ctx.db
            .select()
            .from(campaignTemplates)
            .where(eq(campaignTemplates.id, campaign.templateId));

          return {
            ...campaign,
            config: template
              ? {
                  basePrompt: template.basePrompt,
                  voicemailMessage: template.voicemailMessage,
                  variables: template.variablesConfig,
                  analysis: template.analysisConfig,
                }
              : null,
          };
        }),
      );

      const totalCount = await ctx.db
        .select({ count: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.orgId, orgId))
        .then((rows) => rows.length);

      return {
        campaigns: campaignsWithTemplates,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    }),

  // Get a campaign by ID
  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.orgId;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      return getCampaignWithTemplate(
        ctx.db,
        input.id,
        ctx.auth.isSuperAdmin ? undefined : orgId,
      );
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
      const orgId = ctx.auth.orgId;

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
        llmId: z.string().min(1),
        direction: z.string().min(1),
        basePrompt: z.string().min(1),
        voicemailMessage: z.string().optional(),
        variablesConfig: templateConfigSchema.shape.variablesConfig,
        analysisConfig: templateConfigSchema.shape.analysisConfig,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const {
        basePrompt,
        voicemailMessage,
        variablesConfig,
        analysisConfig,
        ...campaignData
      } = input;

      // First, verify the Retell agent ID is valid
      try {
        const agentInfo = await retell.agent.retrieve(campaignData.agentId);
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

      // First create a template
      const [template] = await ctx.db
        .insert(campaignTemplates)
        .values({
          name: `Template for ${campaignData.name}`,
          description: "Auto-generated from campaign creation",
          agentId: campaignData.agentId,
          llmId: campaignData.llmId,
          basePrompt,
          voicemailMessage,
          variablesConfig,
          analysisConfig,
        })
        .returning();

      // Then create the campaign with a reference to the template
      const [campaign] = await ctx.db
        .insert(campaigns)
        .values({
          orgId: campaignData.orgId,
          name: campaignData.name,
          agentId: campaignData.agentId,
          llmId: campaignData.llmId,
          direction: campaignData.direction as CallDirection,
          templateId: template.id,
          isActive: true,
        })
        .returning();

      return getCampaignWithTemplate(ctx.db, campaign.id);
    }),

  // Update a campaign template (super admin only)
  update: superAdminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        basePrompt: z.string().min(1).optional(),
        voicemailMessage: z.string().optional(),
        variablesConfig: templateConfigSchema.shape.variablesConfig.optional(),
        analysisConfig: templateConfigSchema.shape.analysisConfig.optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const {
        id,
        name,
        basePrompt,
        voicemailMessage,
        variablesConfig,
        analysisConfig,
        isActive,
      } = input;

      // Get the campaign with template
      const campaignWithTemplate = await getCampaignWithTemplate(ctx.db, id);

      // Update the campaign if name or isActive changed
      if (name || isActive !== undefined) {
        await ctx.db
          .update(campaigns)
          .set({
            ...(name ? { name } : {}),
            ...(isActive !== undefined ? { isActive } : {}),
          })
          .where(eq(campaigns.id, id));
      }

      // Update the template if any template-related fields changed
      if (basePrompt || voicemailMessage || variablesConfig || analysisConfig) {
        await ctx.db
          .update(campaignTemplates)
          .set({
            ...(basePrompt ? { basePrompt } : {}),
            ...(voicemailMessage ? { voicemailMessage } : {}),
            ...(variablesConfig ? { variablesConfig } : {}),
            ...(analysisConfig ? { analysisConfig } : {}),
          })
          .where(eq(campaignTemplates.id, campaignWithTemplate.templateId));
      }

      // Get and return the updated campaign
      return getCampaignWithTemplate(ctx.db, id);
    }),

  // Update agent prompt via Retell API
  updateAgentPrompt: superAdminProcedure
    .input(
      z.object({
        agentId: z.string().min(1),
        llmId: z.string().min(1),
        prompt: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // const agent = await retell.agent.retrieve(input.agentId);
        // if (!agent) {
        //   throw new TRPCError({
        //     code: "BAD_REQUEST",
        //     message: "Invalid Retell agent ID",
        //   });
        // }
        // const llmId =
        //   agent.response_engine.type === "retell-llm"
        //     ? agent.response_engine.llm_id
        //     : null;
        // if (!llmId) {
        //   throw new TRPCError({
        //     code: "BAD_REQUEST",
        //     message: "Invalid Retell agent ID",
        //   });
        // }
        const result = await retell.llm.update(input.llmId, {
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
        description: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.orgId;
      const userId = ctx.auth.userId;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Create the campaign request with correct types
      const [campaignRequest] = await ctx.db
        .insert(campaignRequests)
        .values({
          name: input.name,
          orgId: orgId,
          description: input.description,
          status: "pending",
          requestedBy: userId,
          direction: "outbound",
        } as typeof campaignRequests.$inferInsert)
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
      const orgId = ctx.auth.orgId;

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

      // Update the campaign request using partial update
      const [updatedRequest] = await ctx.db
        .update(campaignRequests)
        .set({
          status: status,
          ...(adminNotes && { adminNotes }),
          ...(resultingCampaignId && { resultingCampaignId }),
        } as Partial<typeof campaignRequests.$inferInsert>)
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
