import { getAgent, getAgents, retell } from "@/lib/retell-client";
import { createTRPCRouter, superAdminProcedure } from "@/server/api/trpc";
import {
  calls,
  campaignRequests,
  campaigns,
  organizations,
  runs,
} from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, like, or, SQL, sql } from "drizzle-orm";
import { z } from "zod";

export const adminRouter = createTRPCRouter({
  // Dashboard statistics
  getDashboardStats: superAdminProcedure.query(async ({ ctx }) => {
    // Get counts for various entities
    const [orgCount] = await ctx.db
      .select({ value: count() })
      .from(organizations)
      .where(eq(organizations.isSuperAdmin, false));

    const [campaignCount] = await ctx.db
      .select({ value: count() })
      .from(campaigns);

    const [runCount] = await ctx.db.select({ value: count() }).from(runs);

    const [callCount] = await ctx.db.select({ value: count() }).from(calls);

    const [pendingRequestCount] = await ctx.db
      .select({ value: count() })
      .from(campaignRequests)
      .where(eq(campaignRequests.status, "pending"));

    // Get recent campaign requests
    const recentRequests = await ctx.db
      .select()
      .from(campaignRequests)
      .orderBy(desc(campaignRequests.createdAt))
      .limit(5);

    // Get organizations with most calls
    const topOrgs = await ctx.db
      .select({
        orgId: calls.orgId,
        callCount: count(),
      })
      .from(calls)
      .groupBy(calls.orgId)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    const orgDetails = [];
    if (topOrgs.length > 0) {
      const orgIds = topOrgs.map((o) => o.orgId);
      const orgsData = await ctx.db
        .select()
        .from(organizations)
        .where(sql`${organizations.id} IN (${orgIds.join(",")})`);

      const orgMap = orgsData.reduce(
        (acc, org) => {
          acc[org.id] = org;
          return acc;
        },
        {} as Record<string, typeof organizations.$inferSelect>,
      );

      for (const org of topOrgs) {
        if (orgMap[org.orgId]) {
          orgDetails.push({
            ...orgMap[org.orgId],
            callCount: Number(org.callCount),
          });
        }
      }
    }

    return {
      counts: {
        organizations: Number(orgCount?.value || 0),
        campaigns: Number(campaignCount?.value || 0),
        runs: Number(runCount?.value || 0),
        calls: Number(callCount?.value || 0),
        pendingRequests: Number(pendingRequestCount?.value || 0),
      },
      recentRequests,
      topOrganizations: orgDetails,
    };
  }),

  // Get all Retell agents
  getRetellAgents: superAdminProcedure.query(async () => {
    try {
      const retellAgents = await getAgents();
      const agents = retellAgents.map((agent: any) => ({
        agent_id: agent.agent_id,
        name: agent.agent_name || agent.agent_id,
      }));
      return agents;
    } catch (error) {
      console.error("Error fetching Retell agents:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch Retell agents",
        cause: error,
      });
    }
  }),

  // Configure a Retell agent with webhooks
  configureAgentWebhooks: superAdminProcedure
    .input(
      z.object({
        agent_id: z.string().min(1),
        inbound_org_id: z.string().uuid().optional(),
        post_call_webhook_enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { agent_id, inbound_org_id, post_call_webhook_enabled } = input;

      try {
        const updateData: Record<string, unknown> = {};

        // Configure inbound webhook if org ID is provided
        if (inbound_org_id) {
          // Get the base URL from environment or config
          const apiUrl = process.env.API_URL || "https://api.rivvi.ai";
          updateData.inbound_dynamic_variables_webhook_url = `${apiUrl}/api/webhooks/retell/inbound/${inbound_org_id}`;
        }

        // Configure post-call webhook if enabled
        if (post_call_webhook_enabled) {
          const apiUrl = process.env.API_URL || "https://api.rivvi.ai";
          updateData.post_call_webhook_url = `${apiUrl}/api/webhooks/retell/post-call`;
        }

        // Update the agent if we have data to update
        if (Object.keys(updateData).length > 0) {
          const agent = await retell.agent.update(agent_id, updateData);
          return agent;
        }

        return { message: "No changes to apply" };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to configure agent webhooks",
          cause: error,
        });
      }
    }),

  // Get all organizations including just the id and name
  getOrganizationsIdsAndNames: superAdminProcedure.query(async ({ ctx }) => {
    const orgs = await ctx.db.select().from(organizations);
    return orgs.map((org) => ({ id: org.id, name: org.name }));
  }),

  // Get organizations with campaign and run counts
  getOrganizationsWithStats: superAdminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, search } = input;

      // Base query for organizations
      const baseQuery = ctx.db
        .select({
          org: organizations,
          campaignCount: sql`COUNT(DISTINCT ${campaigns.id})`.mapWith(Number),
          runCount: sql`COUNT(DISTINCT ${runs.id})`.mapWith(Number),
          callCount: sql`COUNT(DISTINCT ${calls.id})`.mapWith(Number),
        })
        .from(organizations)
        .leftJoin(campaigns, eq(organizations.id, campaigns.orgId))
        .leftJoin(runs, eq(organizations.id, runs.orgId))
        .leftJoin(calls, eq(organizations.id, calls.orgId));

      // Build where conditions
      let whereCondition = eq(organizations.isSuperAdmin, false);

      // Add search if provided
      if (search && search.trim() !== "") {
        const searchTerm = `%${search.trim()}%`;
        whereCondition = and(
          whereCondition,
          or(
            like(organizations.name, searchTerm),
            like(organizations.clerkId, searchTerm),
            like(organizations.phone, searchTerm),
          ),
        ) as SQL<unknown>;
      }

      // Complete the query with pagination and grouping
      const results = await baseQuery
        .where(whereCondition)
        .groupBy(organizations.id)
        .limit(limit)
        .offset(offset)
        .orderBy(organizations.createdAt);

      // Count total organizations
      let countWhereCondition = eq(organizations.isSuperAdmin, false);

      // Add search to count query
      if (search && search.trim() !== "") {
        const searchTerm = `%${search.trim()}%`;
        countWhereCondition = and(
          countWhereCondition,
          or(
            like(organizations.name, searchTerm),
            like(organizations.clerkId, searchTerm),
            like(organizations.phone, searchTerm),
          ),
        ) as SQL<unknown>;
      }

      const countResult = await ctx.db
        .select({ value: count() })
        .from(organizations)
        .where(countWhereCondition);

      const totalCount = Number(countResult[0]?.value || 0);

      return {
        organizations: results,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    }),

  // Get recent calls across all organizations
  getRecentCalls: superAdminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;

      // Get recent calls with organization info
      const recentCalls = await ctx.db
        .select({
          call: calls,
          organization: organizations,
        })
        .from(calls)
        .leftJoin(organizations, eq(calls.orgId, organizations.id))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(calls.createdAt));

      // Count total calls
      const countResult = await ctx.db.select({ value: count() }).from(calls);

      const totalCount = Number(countResult[0]?.value || 0);

      return {
        calls: recentCalls,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    }),

  // Process campaign requests in bulk
  processBulkCampaignRequests: superAdminProcedure
    .input(
      z.object({
        requestIds: z.array(z.string().uuid()),
        status: z.enum(["approved", "rejected"]),
        adminNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { requestIds, status, adminNotes } = input;

      if (requestIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No request IDs provided",
        });
      }

      // Update all requests
      const updated = await ctx.db
        .update(campaignRequests)
        .set({
          status,
          adminNotes,
          updatedAt: new Date(),
        })
        .where(sql`${campaignRequests.id} IN (${requestIds.join(",")})`)
        .returning();

      return {
        success: true,
        updatedCount: updated.length,
        updatedRequests: updated,
      };
    }),

  // Create a new campaign (with optional resultingCampaignId for tracking request fulfillment)
  createCampaign: superAdminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        orgId: z.string().uuid(),
        agentId: z.string().min(1),
        type: z.string().min(1).default("general"),
        config: z
          .object({
            basePrompt: z.string().default("You are a helpful assistant."),
            variables: z
              .object({
                patient: z
                  .object({
                    fields: z
                      .array(
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
                      )
                      .default([]),
                    validation: z
                      .object({
                        requireValidPhone: z.boolean().default(true),
                        requireValidDOB: z.boolean().default(true),
                        requireName: z.boolean().default(true),
                      })
                      .default({
                        requireValidPhone: true,
                        requireValidDOB: true,
                        requireName: true,
                      }),
                  })
                  .default({
                    fields: [],
                    validation: {
                      requireValidPhone: true,
                      requireValidDOB: true,
                      requireName: true,
                    },
                  }),
                campaign: z
                  .object({
                    fields: z
                      .array(
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
                      )
                      .default([]),
                  })
                  .default({
                    fields: [],
                  }),
              })
              .default({
                patient: {
                  fields: [],
                  validation: {
                    requireValidPhone: true,
                    requireValidDOB: true,
                    requireName: true,
                  },
                },
                campaign: {
                  fields: [],
                },
              }),
            postCall: z
              .object({
                standard: z
                  .object({
                    fields: z
                      .array(
                        z.object({
                          key: z.string(),
                          label: z.string(),
                          type: z.enum(["boolean", "string", "date", "enum"]),
                          options: z.array(z.string()).optional(),
                          required: z.boolean(),
                          description: z.string().optional(),
                        }),
                      )
                      .default([]),
                  })
                  .default({
                    fields: [],
                  }),
                campaign: z
                  .object({
                    fields: z
                      .array(
                        z.object({
                          key: z.string(),
                          label: z.string(),
                          type: z.enum(["boolean", "string", "date", "enum"]),
                          options: z.array(z.string()).optional(),
                          required: z.boolean(),
                          description: z.string().optional(),
                          isMainKPI: z.boolean().optional(),
                        }),
                      )
                      .default([]),
                  })
                  .default({
                    fields: [],
                  }),
              })
              .default({
                standard: {
                  fields: [],
                },
                campaign: {
                  fields: [],
                },
              }),
          })
          .default({
            basePrompt: "You are a helpful assistant.",
            variables: {
              patient: {
                fields: [],
                validation: {
                  requireValidPhone: true,
                  requireValidDOB: true,
                  requireName: true,
                },
              },
              campaign: {
                fields: [],
              },
            },
            postCall: {
              standard: {
                fields: [],
              },
              campaign: {
                fields: [],
              },
            },
          }),
        requestId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { requestId, ...campaignData } = input;

      // First, verify the organization exists
      const [organization] = await ctx.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, campaignData.orgId));

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify the Retell agent ID is valid
      try {
        const agentInfo = await getAgent(campaignData.agentId);
        if (!agentInfo || !agentInfo.agent_id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid Retell agent ID",
          });
        }
        // Log successful agent verification
        console.log("Successfully verified Retell agent:", agentInfo.agent_id);
      } catch (error) {
        console.error("Error verifying Retell agent:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to verify Retell agent ID",
          cause: error,
        });
      }

      // Create the campaign
      const [campaign] = await ctx.db
        .insert(campaigns)
        .values(campaignData)
        .returning();

      // If requestId is provided, update the request
      if (requestId) {
        await ctx.db
          .update(campaignRequests)
          .set({
            status: "completed",
            resultingCampaignId: campaign?.id || "",
            updatedAt: new Date(),
          })
          .where(eq(campaignRequests.id, requestId));
      }

      return campaign;
    }),
});
