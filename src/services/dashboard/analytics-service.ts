// src/services/dashboard/analytics-service.ts
import {
  ServiceResult,
  createError,
  createSuccess,
} from "@/lib/service-result";
import { db } from "@/server/db";
import { calls, campaigns, patients, runs } from "@/server/db/schema";
// import { type AdminDashboardStats } from "@/types/api/admin";
import { and, count, eq, sql } from "drizzle-orm";

export type DashboardStats = {
  counts: {
    campaigns: number;
    activeRuns: number;
    completedCalls: number;
    patients: number;
  };
};

export const analyticsService = {
  async getDashboardStats(
    orgId: string,
  ): Promise<ServiceResult<DashboardStats>> {
    try {
      // Get campaign count
      const [campaignCount] = await db
        .select({ value: count() })
        .from(campaigns)
        .where(eq(campaigns.orgId, orgId));

      // Get active runs count
      const [activeRunsCount] = await db
        .select({ value: count() })
        .from(runs)
        .where(
          and(
            eq(runs.orgId, orgId),
            sql`${runs.status} IN ('running', 'paused', 'scheduled')`,
          ),
        );

      // Get completed calls count
      const [completedCallsCount] = await db
        .select({ value: count() })
        .from(calls)
        .where(and(eq(calls.orgId, orgId), eq(calls.status, "completed")));

      // Get patients count
      const [patientsCount] = await db
        .select({ value: sql`COUNT(DISTINCT ${patients.id})` })
        .from(patients)
        .innerJoin(calls, eq(patients.id, calls.patientId))
        .where(eq(calls.orgId, orgId));

      return createSuccess({
        counts: {
          campaigns: Number(campaignCount?.value || 0),
          activeRuns: Number(activeRunsCount?.value || 0),
          completedCalls: Number(completedCallsCount?.value || 0),
          patients: Number(patientsCount?.value || 0),
        },
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch dashboard stats",
        error,
      );
    }
  },

  // Additional analytics methods...
};
