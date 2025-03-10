// src/services/calls/call-analytics.ts
import {
  ServiceResult,
  createError,
  createSuccess,
} from "@/lib/service-result";
import {
  calls,
  campaignTemplates,
  campaigns,
  organizations,
  runs,
} from "@/server/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";

export class CallAnalytics {
  private db;

  constructor(db) {
    this.db = db;
  }

  /**
   * Get organization-level dashboard data
   */
  async getOrgDashboard(orgId: string): Promise<
    ServiceResult<{
      callVolume: {
        total: number;
        inbound: number;
        outbound: number;
        completed: number;
        success: number;
      };
      callTrends: {
        date: string;
        count: number;
      }[];
      recentCalls: Array<typeof calls.$inferSelect>;
      topCampaigns: {
        id: string;
        name: string;
        callCount: number;
        successRate: number;
      }[];
    }>
  > {
    try {
      // Get call volume stats
      const [callVolume] = await this.db
        .select({
          total: count(),
          inbound: sql`SUM(CASE WHEN ${calls.direction} = 'inbound' THEN 1 ELSE 0 END)`,
          outbound: sql`SUM(CASE WHEN ${calls.direction} = 'outbound' THEN 1 ELSE 0 END)`,
          completed: sql`SUM(CASE WHEN ${calls.status} = 'completed' THEN 1 ELSE 0 END)`,
          success: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND (${calls.metadata}->>'success')::boolean = true THEN 1 ELSE 0 END)`,
        })
        .from(calls)
        .where(eq(calls.orgId, orgId));

      // Get call trends (last 14 days)
      const callTrends = await this.db
        .select({
          date: sql`TO_CHAR(${calls.createdAt}, 'YYYY-MM-DD')`,
          count: count(),
        })
        .from(calls)
        .where(
          and(
            eq(calls.orgId, orgId),
            sql`${calls.createdAt} >= CURRENT_DATE - INTERVAL '14 days'`,
          ),
        )
        .groupBy(sql`TO_CHAR(${calls.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${calls.createdAt}, 'YYYY-MM-DD')`);

      // Get recent calls
      const recentCalls = await this.db
        .select()
        .from(calls)
        .where(eq(calls.orgId, orgId))
        .orderBy(desc(calls.createdAt))
        .limit(10);

      // Get top campaigns by call volume
      const topCampaignsData = await this.db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          callCount: count(),
          successCount: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND (${calls.metadata}->>'success')::boolean = true THEN 1 ELSE 0 END)`,
          totalCompletedCount: sql`SUM(CASE WHEN ${calls.status} = 'completed' THEN 1 ELSE 0 END)`,
        })
        .from(campaigns)
        .innerJoin(calls, eq(calls.campaignId, campaigns.id))
        .where(eq(campaigns.orgId, orgId))
        .groupBy(campaigns.id, campaigns.name)
        .orderBy(sql`count(*) DESC`)
        .limit(5);

      const topCampaigns = topCampaignsData.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        callCount: Number(campaign.callCount),
        successRate:
          Number(campaign.totalCompletedCount) > 0
            ? (Number(campaign.successCount) /
                Number(campaign.totalCompletedCount)) *
              100
            : 0,
      }));

      return createSuccess({
        callVolume: {
          total: Number(callVolume.total) || 0,
          inbound: Number(callVolume.inbound) || 0,
          outbound: Number(callVolume.outbound) || 0,
          completed: Number(callVolume.completed) || 0,
          success: Number(callVolume.success) || 0,
        },
        callTrends: callTrends.map((trend) => ({
          date: trend.date,
          count: Number(trend.count),
        })),
        recentCalls,
        topCampaigns,
      });
    } catch (error) {
      console.error("Error getting org dashboard:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch dashboard data",
        error,
      );
    }
  }

  /**
   * Get call analytics by time of day/week
   */
  async getCallAnalyticsByTime(
    orgId: string,
    period: "day" | "week" | "month",
    timezone?: string,
  ): Promise<
    ServiceResult<{
      byTime: {
        timeSlot: string;
        count: number;
        successRate: number;
      }[];
    }>
  > {
    try {
      // Use organization timezone if not specified
      if (!timezone) {
        const [org] = await this.db
          .select({ timezone: organizations.timezone })
          .from(organizations)
          .where(eq(organizations.id, orgId));

        timezone = org?.timezone || "UTC";
      }

      // Generate appropriate time slot based on period
      let timeSlotExpression;
      if (period === "day") {
        timeSlotExpression = sql`EXTRACT(HOUR FROM ${calls.startTime} AT TIME ZONE ${timezone})`;
      } else if (period === "week") {
        timeSlotExpression = sql`EXTRACT(DOW FROM ${calls.startTime} AT TIME ZONE ${timezone})`;
      } else {
        timeSlotExpression = sql`EXTRACT(DAY FROM ${calls.startTime} AT TIME ZONE ${timezone})`;
      }

      // Query for analytics
      const analytics = await this.db
        .select({
          timeSlot: timeSlotExpression,
          count: count(),
          successCount: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND (${calls.metadata}->>'success')::boolean = true THEN 1 ELSE 0 END)`,
          totalCompletedCount: sql`SUM(CASE WHEN ${calls.status} = 'completed' THEN 1 ELSE 0 END)`,
        })
        .from(calls)
        .where(and(eq(calls.orgId, orgId), sql`${calls.startTime} IS NOT NULL`))
        .groupBy(timeSlotExpression)
        .orderBy(timeSlotExpression);

      const results = analytics.map((slot) => ({
        timeSlot: String(slot.timeSlot),
        count: Number(slot.count),
        successRate:
          Number(slot.totalCompletedCount) > 0
            ? (Number(slot.successCount) / Number(slot.totalCompletedCount)) *
              100
            : 0,
      }));

      return createSuccess({
        byTime: results,
      });
    } catch (error) {
      console.error("Error getting call analytics by time:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch time-based analytics",
        error,
      );
    }
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<
    ServiceResult<{
      callMetrics: {
        total: number;
        completed: number;
        failed: number;
        voicemail: number;
        inProgress: number;
        pending: number;
        successRate: number;
      };
      conversionMetrics: {
        field: string;
        label: string;
        type: string;
        values: Record<string, number>;
        total: number;
        rate: number;
      }[];
      runMetrics: {
        id: string;
        name: string;
        totalCalls: number;
        completedCalls: number;
        conversionRate: number;
      }[];
    }>
  > {
    try {
      // Get call metrics for the campaign
      const [callMetrics] = await this.db
        .select({
          total: count(),
          completed: sql`SUM(CASE WHEN ${calls.status} = 'completed' THEN 1 ELSE 0 END)`,
          failed: sql`SUM(CASE WHEN ${calls.status} = 'failed' THEN 1 ELSE 0 END)`,
          voicemail: sql`SUM(CASE WHEN ${calls.status} = 'voicemail' THEN 1 ELSE 0 END)`,
          inProgress: sql`SUM(CASE WHEN ${calls.status} = 'in-progress' THEN 1 ELSE 0 END)`,
          pending: sql`SUM(CASE WHEN ${calls.status} = 'pending' THEN 1 ELSE 0 END)`,
          success: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND (${calls.metadata}->>'success')::boolean = true THEN 1 ELSE 0 END)`,
        })
        .from(calls)
        .where(eq(calls.campaignId, campaignId));

      // Get campaign analysis fields
      const [campaign] = await this.db
        .select({
          campaign: campaigns,
          template: campaignTemplates,
        })
        .from(campaigns)
        .leftJoin(
          campaignTemplates,
          eq(campaigns.templateId, campaignTemplates.id),
        )
        .where(eq(campaigns.id, campaignId));

      const analysisFields =
        campaign?.template?.analysisConfig?.campaign?.fields || [];

      // Get conversion metrics for each analysis field
      const conversionMetrics = [];
      for (const field of analysisFields) {
        if (field.type === "boolean") {
          // For boolean fields, get true/false counts
          const fieldKey = field.key;

          // More robust boolean handling - check if value is 'true'/'false' strings or actual boolean
          const [metrics] = await this.db
            .select({
              trueCount: sql`SUM(CASE 
                WHEN ${calls.analysis}->>${sql.raw(`'${fieldKey}'`)} = 'true' 
                OR ${calls.analysis}->>${sql.raw(`'${fieldKey}'`)} = '1' 
                OR ${calls.analysis}->>${sql.raw(`'${fieldKey}'`)} = 't' 
                OR ${calls.analysis}->>${sql.raw(`'${fieldKey}'`)} = 'yes' 
                OR ${calls.analysis}->>${sql.raw(`'${fieldKey}'`)} = 'y' 
                THEN 1 ELSE 0 END)`,
              falseCount: sql`SUM(CASE 
                WHEN ${calls.analysis}->>${sql.raw(`'${fieldKey}'`)} = 'false' 
                OR ${calls.analysis}->>${sql.raw(`'${fieldKey}'`)} = '0' 
                OR ${calls.analysis}->>${sql.raw(`'${fieldKey}'`)} = 'f' 
                OR ${calls.analysis}->>${sql.raw(`'${fieldKey}'`)} = 'no' 
                OR ${calls.analysis}->>${sql.raw(`'${fieldKey}'`)} = 'n' 
                THEN 1 ELSE 0 END)`,
              total: count(),
            })
            .from(calls)
            .where(
              and(
                eq(calls.campaignId, campaignId),
                eq(calls.status, "completed"),
              ),
            );

          conversionMetrics.push({
            field: field.key,
            label: field.label,
            type: field.type,
            values: {
              true: Number(metrics.trueCount) || 0,
              false: Number(metrics.falseCount) || 0,
            },
            total: Number(metrics.total) || 0,
            rate:
              Number(metrics.total) > 0
                ? (Number(metrics.trueCount) / Number(metrics.total)) * 100
                : 0,
          });
        } else if (field.type === "enum" && field.options) {
          // For enum fields, get counts for each option
          const values: Record<string, number> = {};
          const fieldKey = field.key;

          // Initialize with all options
          field.options.forEach((option) => {
            values[option] = 0;
          });

          // Get actual counts
          const optionCounts = await this.db
            .select({
              option: sql`${calls.analysis}->>${sql.raw(`'${fieldKey}'`)}`,
              count: count(),
            })
            .from(calls)
            .where(
              and(
                eq(calls.campaignId, campaignId),
                eq(calls.status, "completed"),
                sql`${calls.analysis}->>${sql.raw(`'${fieldKey}'`)} IS NOT NULL`,
              ),
            )
            .groupBy(sql`${calls.analysis}->>${sql.raw(`'${fieldKey}'`)}`);

          // Fill in actual counts
          optionCounts.forEach((result) => {
            if (result.option) {
              values[result.option] = Number(result.count) || 0;
            }
          });

          // Get total completed calls for this field
          const [totalResult] = await this.db
            .select({
              total: count(),
            })
            .from(calls)
            .where(
              and(
                eq(calls.campaignId, campaignId),
                eq(calls.status, "completed"),
              ),
            );

          const total = Number(totalResult.total) || 0;

          // Determine main value for conversion rate
          const mainOption = field.options[0] || ""; // Default to first option
          const mainCount = values[mainOption] || 0;

          conversionMetrics.push({
            field: field.key,
            label: field.label,
            type: field.type,
            values,
            total,
            rate: total > 0 ? (mainCount / total) * 100 : 0,
          });
        }
      }

      // Get run metrics
      const runMetrics = await this.db
        .select({
          id: runs.id,
          name: runs.name,
          totalCalls: sql`COUNT(${calls.id})`,
          completedCalls: sql`SUM(CASE WHEN ${calls.status} = 'completed' THEN 1 ELSE 0 END)`,
          successCalls: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND (${calls.metadata}->>'success')::boolean = true THEN 1 ELSE 0 END)`,
        })
        .from(runs)
        .leftJoin(calls, eq(calls.runId, runs.id))
        .where(eq(runs.campaignId, campaignId))
        .groupBy(runs.id, runs.name)
        .orderBy(desc(runs.createdAt))
        .limit(10);

      return createSuccess({
        callMetrics: {
          total: Number(callMetrics.total) || 0,
          completed: Number(callMetrics.completed) || 0,
          failed: Number(callMetrics.failed) || 0,
          voicemail: Number(callMetrics.voicemail) || 0,
          inProgress: Number(callMetrics.inProgress) || 0,
          pending: Number(callMetrics.pending) || 0,
          successRate:
            Number(callMetrics.completed) > 0
              ? (Number(callMetrics.success) / Number(callMetrics.completed)) *
                100
              : 0,
        },
        conversionMetrics,
        runMetrics: runMetrics.map((run) => ({
          id: run.id,
          name: run.name,
          totalCalls: Number(run.totalCalls) || 0,
          completedCalls: Number(run.completedCalls) || 0,
          conversionRate:
            Number(run.completedCalls) > 0
              ? (Number(run.successCalls) / Number(run.completedCalls)) * 100
              : 0,
        })),
      });
    } catch (error) {
      console.error("Error getting campaign analytics:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch campaign analytics",
        error,
      );
    }
  }
}
