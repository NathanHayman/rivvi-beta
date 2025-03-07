// src/services/admin/dashboard-service.ts
import {
  ServiceResult,
  createError,
  createSuccess,
} from "@/lib/service-result";
import { db } from "@/server/db";
import {
  calls,
  campaignRequests,
  campaigns,
  organizations,
  runs,
} from "@/server/db/schema";
import { count, desc, eq, sql } from "drizzle-orm";

export const dashboardService = {
  async getStats(): Promise<
    ServiceResult<{
      counts: {
        organizations: number;
        campaigns: number;
        runs: number;
        calls: number;
        pendingRequests: number;
      };
      recentRequests: Array<typeof campaignRequests.$inferSelect>;
      topOrganizations: Array<{
        id: string;
        name: string;
        callCount: number;
      }>;
    }>
  > {
    try {
      // Get counts for various entities
      const [orgCount] = await db
        .select({ value: count() })
        .from(organizations)
        .where(eq(organizations.isSuperAdmin, false));

      const [campaignCount] = await db
        .select({ value: count() })
        .from(campaigns);

      const [runCount] = await db.select({ value: count() }).from(runs);

      const [callCount] = await db.select({ value: count() }).from(calls);

      const [pendingRequestCount] = await db
        .select({ value: count() })
        .from(campaignRequests)
        .where(eq(campaignRequests.status, "pending"));

      // Get recent campaign requests
      const recentRequests = await db
        .select()
        .from(campaignRequests)
        .orderBy(desc(campaignRequests.createdAt))
        .limit(5);

      // Get organizations with most calls
      const topOrgs = await db
        .select({
          orgId: calls.orgId,
          callCount: count(),
        })
        .from(calls)
        .groupBy(calls.orgId)
        .orderBy(sql`count(*) DESC`)
        .limit(5);

      const orgIds = topOrgs.map((o) => o.orgId);

      const orgsData = await db
        .select()
        .from(organizations)
        .where(sql`${organizations.id} IN (${orgIds.join(",")})`);

      const orgMap = Object.fromEntries(orgsData.map((org) => [org.id, org]));

      const topOrganizations = topOrgs
        .map((org) => {
          const orgData = orgMap[org.orgId];
          if (!orgData) return null;

          return {
            id: orgData.id,
            name: orgData.name,
            callCount: Number(org.callCount),
          };
        })
        .filter(Boolean);

      return createSuccess({
        counts: {
          organizations: Number(orgCount?.value || 0),
          campaigns: Number(campaignCount?.value || 0),
          runs: Number(runCount?.value || 0),
          calls: Number(callCount?.value || 0),
          pendingRequests: Number(pendingRequestCount?.value || 0),
        },
        recentRequests,
        topOrganizations,
      });
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch dashboard stats",
        error,
      );
    }
  },

  async getRecentCalls(options: { limit?: number; offset?: number }): Promise<
    ServiceResult<{
      calls: Array<{
        call: typeof calls.$inferSelect;
        organization: typeof organizations.$inferSelect;
      }>;
      totalCount: number;
      hasMore: boolean;
    }>
  > {
    try {
      const { limit = 50, offset = 0 } = options;

      // Get recent calls with organization info
      const recentCalls = await db
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
      const [{ value: totalCount }] = await db
        .select({ value: count() })
        .from(calls);

      return createSuccess({
        calls: recentCalls,
        totalCount: Number(totalCount),
        hasMore: offset + limit < Number(totalCount),
      });
    } catch (error) {
      console.error("Error getting recent calls:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch recent calls",
        error,
      );
    }
  },
};
