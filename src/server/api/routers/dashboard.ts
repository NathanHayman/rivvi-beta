// src/server/api/routers/dashboard.ts
import { CallAnalytics } from "@/lib/call/call-analytics";
import {
  createTRPCRouter,
  orgProcedure,
  superAdminProcedure,
} from "@/server/api/trpc";
import {
  calls,
  campaigns,
  organizations,
  patients,
  runs,
} from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

export const dashboardRouter = createTRPCRouter({
  // Get basic dashboard stats
  getStats: orgProcedure.query(async ({ ctx }) => {
    const orgId = ctx.auth.orgId;

    if (!orgId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active organization",
      });
    }

    // Get the database organization ID
    const [dbOrg] = await ctx.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!dbOrg) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }

    // Count campaigns
    const [campaignsCount] = await ctx.db
      .select({ value: count() })
      .from(campaigns)
      .where(eq(campaigns.orgId, dbOrg.id));

    // Count active runs
    const [activeRunsCount] = await ctx.db
      .select({ value: count() })
      .from(runs)
      .where(
        and(
          eq(runs.orgId, dbOrg.id),
          sql`${runs.status} IN ('running', 'paused', 'scheduled')`,
        ),
      );

    // Count completed calls
    const [completedCallsCount] = await ctx.db
      .select({ value: count() })
      .from(calls)
      .where(and(eq(calls.orgId, dbOrg.id), eq(calls.status, "completed")));

    // Count patients
    const [patientsCount] = await ctx.db
      .select({ value: sql`COUNT(DISTINCT ${patients.id})` })
      .from(patients)
      .innerJoin(calls, eq(patients.id, calls.patientId))
      .where(eq(calls.orgId, dbOrg.id));

    return {
      campaigns: Number(campaignsCount?.value || 0),
      activeRuns: Number(activeRunsCount?.value || 0),
      completedCalls: Number(completedCallsCount?.value || 0),
      patients: Number(patientsCount?.value || 0),
    };
  }),

  // Get organization dashboard data with detailed analytics
  getOrgDashboard: orgProcedure.query(async ({ ctx }) => {
    try {
      const orgId = ctx.auth.orgId;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      const callAnalytics = new CallAnalytics(ctx.db);
      return await callAnalytics.getOrgDashboard(orgId);
    } catch (error) {
      console.error("Error getting org dashboard:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch dashboard data",
        cause: error,
      });
    }
  }),

  // Get call analytics by time of day/week
  getCallAnalyticsByTime: orgProcedure
    .input(
      z.object({
        period: z.enum(["day", "week", "month", "quarter"]).default("week"),
        timezone: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const orgId = ctx.auth.orgId;

        if (!orgId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No active organization",
          });
        }

        const callAnalytics = new CallAnalytics(ctx.db);
        return await callAnalytics.getCallAnalyticsByTime(
          orgId,
          input.period as "day" | "week" | "month",
          input.timezone,
        );
      } catch (error) {
        console.error("Error getting call analytics by time:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch time-based analytics",
          cause: error,
        });
      }
    }),

  // Get campaign analytics
  getCampaignAnalytics: orgProcedure
    .input(
      z.object({
        campaignId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const callAnalytics = new CallAnalytics(ctx.db);

      try {
        return await callAnalytics.getCampaignAnalytics(input.campaignId);
      } catch (error) {
        console.error("Error getting campaign analytics:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch campaign analytics",
          cause: error,
        });
      }
    }),

  // Get run analytics
  getRunAnalytics: orgProcedure
    .input(
      z.object({
        runId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const callAnalytics = new CallAnalytics(ctx.db);

      try {
        return await callAnalytics.getRunAnalytics(input.runId);
      } catch (error) {
        console.error("Error getting run analytics:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch run analytics",
          cause: error,
        });
      }
    }),

  // Generate report for export
  generateReport: orgProcedure
    .input(
      z.object({
        orgId: z.string().optional(),
        reportType: z.enum(["calls", "campaigns", "runs", "patients"]),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        campaignId: z.string().optional(),
        runId: z.string().optional(),
        format: z.enum(["csv", "json"]).default("csv"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const callAnalytics = new CallAnalytics(ctx.db);

      try {
        const clerkOrgId = input.orgId || ctx.auth.orgId;

        if (!clerkOrgId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Organization ID is required",
          });
        }

        // Get the database organization ID
        const [dbOrg] = await ctx.db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.id, clerkOrgId));

        if (!dbOrg) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
          });
        }

        return await callAnalytics.generateReport({
          orgId: dbOrg.id,
          reportType: input.reportType,
          startDate: input.startDate,
          endDate: input.endDate,
          campaignId: input.campaignId,
          runId: input.runId,
          format: input.format,
        });
      } catch (error) {
        console.error("Error generating report:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate report",
          cause: error,
        });
      }
    }),

  // Admin dashboard for all organizations
  getSuperAdminDashboard: superAdminProcedure.query(async ({ ctx }) => {
    try {
      // Get organization counts
      const [orgCount] = await ctx.db
        .select({ count: count() })
        .from(organizations)
        .where(sql`${organizations.isSuperAdmin} = false`);

      // Get campaign counts
      const [campaignCounts] = await ctx.db
        .select({
          total: count(),
          active: sql`COUNT(${campaigns.id}) FILTER (WHERE ${campaigns.isActive} = true)`,
        })
        .from(campaigns);

      // Get call stats
      const [callCounts] = await ctx.db
        .select({
          total: count(),
          completed: sql`COUNT(${calls.id}) FILTER (WHERE ${calls.status} = 'completed')`,
          active: sql`COUNT(${calls.id}) FILTER (WHERE ${calls.status} = 'in-progress')`,
          failed: sql`COUNT(${calls.id}) FILTER (WHERE ${calls.status} = 'failed')`,
        })
        .from(calls);

      // Get patient counts
      const [patientCount] = await ctx.db
        .select({ count: count() })
        .from(patients);

      // Get recent organizations
      const recentOrgs = await ctx.db
        .select()
        .from(organizations)
        .where(sql`${organizations.isSuperAdmin} = false`)
        .orderBy(desc(organizations.createdAt))
        .limit(5);

      // Get top campaigns by call volume
      const topCampaigns = await ctx.db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          orgId: campaigns.orgId,
          orgName: organizations.name,
          callCount: sql`COUNT(${calls.id})`.mapWith(Number),
        })
        .from(campaigns)
        .leftJoin(calls, eq(calls.campaignId, campaigns.id))
        .leftJoin(organizations, eq(organizations.id, campaigns.orgId))
        .groupBy(
          campaigns.id,
          campaigns.name,
          campaigns.orgId,
          organizations.name,
        )
        .orderBy(sql`COUNT(${calls.id}) DESC`)
        .limit(5);

      return {
        orgStats: {
          totalOrgs: Number(orgCount?.count || 0),
          recentOrgs,
        },
        campaignStats: {
          totalCampaigns: Number(campaignCounts?.total || 0),
          activeCampaigns: Number(campaignCounts?.active || 0),
          topCampaigns,
        },
        callStats: {
          totalCalls: Number(callCounts?.total || 0),
          completedCalls: Number(callCounts?.completed || 0),
          activeCalls: Number(callCounts?.active || 0),
          failedCalls: Number(callCounts?.failed || 0),
        },
        patientStats: {
          totalPatients: Number(patientCount?.count || 0),
        },
      };
    } catch (error) {
      console.error("Error getting super admin dashboard:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch super admin dashboard data",
        cause: error,
      });
    }
  }),

  // Get upcoming (scheduled/running/paused) runs
  getUpcomingRuns: orgProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(5),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit } = input;
      const orgId = ctx.auth.orgId;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Get the database organization ID
      const [dbOrg] = await ctx.db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (!dbOrg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Get scheduled runs first
      const scheduledRuns = await ctx.db
        .select({
          run: runs,
          campaignName: campaigns.name,
        })
        .from(runs)
        .innerJoin(campaigns, eq(runs.campaignId, campaigns.id))
        .where(
          and(
            eq(runs.orgId, dbOrg.id),
            sql`${runs.status} IN ('scheduled', 'running', 'paused', 'ready')`,
          ),
        )
        .orderBy(runs.scheduledAt, desc(runs.createdAt))
        .limit(limit);

      return {
        runs: scheduledRuns.map((item) => ({
          ...item.run,
          campaign: {
            name: item.campaignName,
          },
        })),
      };
    }),

  // Get recent activity across campaigns, runs, and calls
  getRecentActivity: orgProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit } = input;
      const orgId = ctx.auth.orgId;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Get the database organization ID
      const [dbOrg] = await ctx.db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (!dbOrg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Get recent campaign creations
      const recentCampaigns = await ctx.db
        .select({
          id: campaigns.id,
          type: sql<string>`'campaign_created'`,
          entityId: campaigns.id,
          name: campaigns.name,
          createdAt: campaigns.createdAt,
        })
        .from(campaigns)
        .where(eq(campaigns.orgId, dbOrg.id))
        .orderBy(desc(campaigns.createdAt))
        .limit(limit);

      // Get recent run creations/completions
      const recentRuns = await ctx.db
        .select({
          id: runs.id,
          type: sql<string>`'run_' || ${runs.status}`,
          entityId: runs.id,
          name: runs.name,
          createdAt: runs.createdAt,
        })
        .from(runs)
        .where(eq(runs.orgId, dbOrg.id))
        .orderBy(desc(runs.createdAt))
        .limit(limit);

      // Get recent completed calls
      const recentCalls = await ctx.db
        .select({
          id: calls.id,
          type: sql<string>`'call_' || ${calls.status}`,
          entityId: calls.id,
          name: sql<string>`'Call ' || ${calls.id}`,
          createdAt: calls.createdAt,
        })
        .from(calls)
        .where(and(eq(calls.orgId, dbOrg.id), eq(calls.status, "completed")))
        .orderBy(desc(calls.createdAt))
        .limit(limit);

      // Combine and sort all activity
      const allActivity = [...recentCampaigns, ...recentRuns, ...recentCalls]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, limit);

      return {
        activities: allActivity,
      };
    }),
});
