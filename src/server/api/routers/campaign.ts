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
  campaignRequests,
  campaignTemplates,
  campaigns,
  organizations,
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
  db: typeof import("@/server/db").db,
  campaignId: string,
) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });

  if (!campaign) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Campaign not found",
    });
  }

  const template = await db.query.campaignTemplates.findFirst({
    where: eq(campaignTemplates.id, campaign.templateId),
  });

  if (!template) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Campaign template not found",
    });
  }

  const result = { ...campaign, template };

  // Debug log
  console.log("getCampaignWithTemplate result:", {
    campaignId: campaign.id,
    templateId: campaign.templateId,
    templateAgentId: template.agentId,
  });

  return result;
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

      return getCampaignWithTemplate(ctx.db, input.id);
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

  // Create a new campaign
  create: superAdminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        orgId: z.string().uuid(),
        agentId: z.string().min(1),
        llmId: z.string().min(1),
        direction: z.enum(["inbound", "outbound"]),
        basePrompt: z.string().min(1),
        voicemailMessage: z.string().optional(),
        variablesConfig: z.object({
          patient: z.object({
            fields: z.array(
              z.object({
                key: z.string().min(1),
                label: z.string().min(1),
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
                required: z.boolean().default(true),
                description: z.string().optional(),
              }),
            ),
            validation: z.object({
              requireValidPhone: z.boolean().default(true),
              requireValidDOB: z.boolean().default(true),
              requireName: z.boolean().default(true),
            }),
          }),
          campaign: z.object({
            fields: z.array(
              z.object({
                key: z.string().min(1),
                label: z.string().min(1),
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
                required: z.boolean().default(false),
                description: z.string().optional(),
              }),
            ),
          }),
        }),
        analysisConfig: z.object({
          standard: z.object({
            fields: z.array(
              z.object({
                key: z.string().min(1),
                label: z.string().min(1),
                type: z.enum(["boolean", "string", "date", "enum"]),
                options: z.array(z.string()).optional(),
                required: z.boolean().default(true),
                description: z.string().optional(),
              }),
            ),
          }),
          campaign: z.object({
            fields: z.array(
              z.object({
                key: z.string().min(1),
                label: z.string().min(1),
                type: z.enum(["boolean", "string", "date", "enum"]),
                options: z.array(z.string()).optional(),
                required: z.boolean().default(false),
                description: z.string().optional(),
                isMainKPI: z.boolean().default(false),
              }),
            ),
          }),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const {
        name,
        description,
        orgId,
        agentId,
        llmId,
        direction,
        basePrompt,
        voicemailMessage,
        variablesConfig,
        analysisConfig,
      } = input;

      // Verify the organization exists
      const [organization] = await ctx.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // First create a template - ensure we pass properly shaped data according to schema
      const templateData = {
        name: input.name,
        description: input.description || "",
        agentId: input.agentId,
        llmId: input.llmId,
        basePrompt: input.basePrompt,
        voicemailMessage: input.voicemailMessage,
        variablesConfig: {
          patient: {
            fields:
              input.variablesConfig.patient?.fields?.map((field) => ({
                key: field.key || "",
                label: field.label || "",
                possibleColumns: field.possibleColumns || [],
                transform: field.transform,
                required: field.required || false,
                description: field.description,
              })) || [],
            validation: {
              requireValidPhone:
                input.variablesConfig.patient?.validation?.requireValidPhone ||
                false,
              requireValidDOB:
                input.variablesConfig.patient?.validation?.requireValidDOB ||
                false,
              requireName:
                input.variablesConfig.patient?.validation?.requireName || false,
            },
          },
          campaign: {
            fields:
              input.variablesConfig.campaign?.fields?.map((field) => ({
                key: field.key || "",
                label: field.label || "",
                possibleColumns: field.possibleColumns || [],
                transform: field.transform,
                required: field.required || false,
                description: field.description,
              })) || [],
          },
        },
        analysisConfig: {
          standard: {
            fields:
              input.analysisConfig.standard?.fields?.map((field) => ({
                key: field.key || "",
                label: field.label || "",
                type: field.type || "string",
                options: field.options,
                required: field.required || false,
                description: field.description,
              })) || [],
          },
          campaign: {
            fields:
              input.analysisConfig.campaign?.fields?.map((field) => ({
                key: field.key || "",
                label: field.label || "",
                type: field.type || "string",
                options: field.options,
                required: field.required || false,
                description: field.description,
                isMainKPI: field.isMainKPI,
              })) || [],
          },
        },
      };

      const [template] = await ctx.db
        .insert(campaignTemplates)
        .values(templateData)
        .returning();

      // Create the campaign with a reference to the template
      const campaignValues = {
        name: input.name,
        orgId: input.orgId,
        templateId: template.id,
        direction: input.direction,
        isActive: true,
        isDefaultInbound: input.direction === "inbound",
        metadata: {},
      };

      const [campaign] = await ctx.db
        .insert(campaigns)
        .values(campaignValues)
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
        variablesConfig: z
          .object({
            patient: z.object({
              fields: z.array(
                z.object({
                  key: z.string().min(1),
                  label: z.string().min(1),
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
                  required: z.boolean().default(true),
                  description: z.string().optional(),
                }),
              ),
              validation: z.object({
                requireValidPhone: z.boolean().default(true),
                requireValidDOB: z.boolean().default(true),
                requireName: z.boolean().default(true),
              }),
            }),
            campaign: z.object({
              fields: z.array(
                z.object({
                  key: z.string().min(1),
                  label: z.string().min(1),
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
                  required: z.boolean().default(false),
                  description: z.string().optional(),
                }),
              ),
            }),
          })
          .optional(),
        analysisConfig: z
          .object({
            standard: z.object({
              fields: z.array(
                z.object({
                  key: z.string().min(1),
                  label: z.string().min(1),
                  type: z.enum(["boolean", "string", "date", "enum"]),
                  options: z.array(z.string()).optional(),
                  required: z.boolean().default(true),
                  description: z.string().optional(),
                }),
              ),
            }),
            campaign: z.object({
              fields: z.array(
                z.object({
                  key: z.string().min(1),
                  label: z.string().min(1),
                  type: z.enum(["boolean", "string", "date", "enum"]),
                  options: z.array(z.string()).optional(),
                  required: z.boolean().default(false),
                  description: z.string().optional(),
                  isMainKPI: z.boolean().default(false),
                }),
              ),
            }),
          })
          .optional(),
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
        // We need to ensure the updated fields match the schema exactly
        const updateData: Record<string, unknown> = {};

        if (basePrompt) updateData.basePrompt = basePrompt;
        if (voicemailMessage) updateData.voicemailMessage = voicemailMessage;
        if (variablesConfig) updateData.variablesConfig = variablesConfig;
        if (analysisConfig) updateData.analysisConfig = analysisConfig;

        await ctx.db
          .update(campaignTemplates)
          .set(updateData)
          .where(
            eq(campaignTemplates.id, (campaignWithTemplate.template as any).id),
          );
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
        mainGoal: z.string().min(1).optional(),
        desiredAnalysis: z.array(z.string()).optional(),
        exampleSheets: z
          .array(
            z.object({
              name: z.string(),
              url: z.string(),
              fileType: z.string(),
            }),
          )
          .optional(),
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
          mainGoal: input.mainGoal,
          desiredAnalysis: input.desiredAnalysis,
          exampleSheets: input.exampleSheets,
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
