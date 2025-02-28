// src/server/api/routers/dashboard.ts
import { createTRPCRouter, orgProcedure } from "@/server/api/trpc";
import { calls, campaigns, patients, runs } from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

export const dashboardRouter = createTRPCRouter({
  // Get basic dashboard stats
  getStats: orgProcedure.query(async ({ ctx }) => {
    const orgId = ctx.auth.organization?.id;

    if (!orgId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active organization",
      });
    }

    // Count campaigns
    const [campaignsCount] = await ctx.db
      .select({ value: count() })
      .from(campaigns)
      .where(eq(campaigns.orgId, orgId));

    // Count active runs
    const [activeRunsCount] = await ctx.db
      .select({ value: count() })
      .from(runs)
      .where(
        and(
          eq(runs.orgId, orgId),
          sql`${runs.status} IN ('running', 'paused', 'scheduled')`,
        ),
      );

    // Count completed calls
    const [completedCallsCount] = await ctx.db
      .select({ value: count() })
      .from(calls)
      .where(and(eq(calls.orgId, orgId), eq(calls.status, "completed")));

    // Count patients
    const [patientsCount] = await ctx.db
      .select({ value: sql`COUNT(DISTINCT ${patients.id})` })
      .from(patients)
      .innerJoin(calls, eq(patients.id, calls.patientId))
      .where(eq(calls.orgId, orgId));

    return {
      campaigns: Number(campaignsCount?.value || 0),
      activeRuns: Number(activeRunsCount?.value || 0),
      completedCalls: Number(completedCallsCount?.value || 0),
      patients: Number(patientsCount?.value || 0),
    };
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
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
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
            eq(runs.orgId, orgId),
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
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
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
        .where(eq(campaigns.orgId, orgId))
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
        .where(eq(runs.orgId, orgId))
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
        .where(and(eq(calls.orgId, orgId), eq(calls.status, "completed")))
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
