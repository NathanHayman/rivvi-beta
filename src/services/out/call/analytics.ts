// src/lib/call-analytics.ts
import {
  calls,
  campaigns,
  organizations,
  patients,
  rows as rowsTable,
  runs,
} from "@/server/db/schema";
import { format as formatDate, subDays, subMonths } from "date-fns";
import { and, avg, count, desc, eq, gte, lt, sql } from "drizzle-orm";

type DatabaseClient = typeof import("@/server/db").db;

/**
 * Service for analyzing call and campaign performance
 */
export class CallAnalytics {
  private db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  /**
   * Get overall organization metrics dashboard
   * @param orgId Organization ID
   */
  async getOrgDashboard(orgId: string): Promise<{
    campaigns: {
      total: number;
      active: number;
    };
    calls: {
      total: number;
      completed: number;
      inProgress: number;
      failed: number;
    };
    runs: {
      total: number;
      active: number;
      completed: number;
      scheduled: number;
    };
    reachRates: {
      overall: number;
      lastWeek: number;
      trend: "up" | "down" | "stable";
    };
    voicemailRates: {
      overall: number;
      lastWeek: number;
    };
    conversionRates: {
      overall: number;
      lastWeek: number;
    };
    callVolume: {
      byDay: Array<{ date: string; count: number }>;
    };
  }> {
    try {
      // Campaign stats
      const [campaignStats] = await this.db
        .select({
          total: count(),
          active: sql<number>`count(CASE WHEN ${campaigns.isActive} = true THEN 1 END)`,
        })
        .from(campaigns)
        .where(eq(campaigns.orgId, orgId));

      // Call stats
      const [callStats] = await this.db
        .select({
          total: count(),
          completed: sql<number>`count(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
          inProgress: sql<number>`count(CASE WHEN ${calls.status} = 'in-progress' THEN 1 END)`,
          failed: sql<number>`count(CASE WHEN ${calls.status} = 'failed' THEN 1 END)`,
        })
        .from(calls)
        .where(eq(calls.orgId, orgId));

      // Run stats
      const [runStats] = await this.db
        .select({
          total: count(),
          active: sql<number>`count(CASE WHEN ${runs.status} = 'running' THEN 1 END)`,
          completed: sql<number>`count(CASE WHEN ${runs.status} = 'completed' THEN 1 END)`,
          scheduled: sql<number>`count(CASE WHEN ${runs.status} = 'scheduled' THEN 1 END)`,
        })
        .from(runs)
        .where(eq(runs.orgId, orgId));

      // Calculate reach rates
      const oneWeekAgo = subDays(new Date(), 7);

      // Overall reach rate
      const [overallReachRate] = await this.db
        .select({
          reached: sql<number>`count(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'patient_reached' = 'true' THEN 1 END)`,
          total: sql<number>`count(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
        })
        .from(calls)
        .where(eq(calls.orgId, orgId));

      // Last week reach rate
      const [weeklyReachRate] = await this.db
        .select({
          reached: sql<number>`count(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'patient_reached' = 'true' THEN 1 END)`,
          total: sql<number>`count(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
        })
        .from(calls)
        .where(and(eq(calls.orgId, orgId), gte(calls.createdAt, oneWeekAgo)));

      // Calculate voicemail rates
      const [overallVoicemailRate] = await this.db
        .select({
          voicemail: sql<number>`count(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'left_voicemail' = 'true' THEN 1 END)`,
          total: sql<number>`count(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
        })
        .from(calls)
        .where(eq(calls.orgId, orgId));

      // Last week voicemail rate
      const [weeklyVoicemailRate] = await this.db
        .select({
          voicemail: sql<number>`count(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'left_voicemail' = 'true' THEN 1 END)`,
          total: sql<number>`count(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
        })
        .from(calls)
        .where(and(eq(calls.orgId, orgId), gte(calls.createdAt, oneWeekAgo)));

      // Calculate conversion rates (depends on specific campaign goals)
      const [overallConversionRate] = await this.db
        .select({
          converted: sql<number>`count(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'conversion' = 'true' THEN 1 END)`,
          total: sql<number>`count(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
        })
        .from(calls)
        .where(eq(calls.orgId, orgId));

      // Last week conversion rate
      const [weeklyConversionRate] = await this.db
        .select({
          converted: sql<number>`count(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'conversion' = 'true' THEN 1 END)`,
          total: sql<number>`count(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
        })
        .from(calls)
        .where(and(eq(calls.orgId, orgId), gte(calls.createdAt, oneWeekAgo)));

      // Call volume by day (last 14 days)
      const twoWeeksAgo = subDays(new Date(), 14);

      const callVolumeByDay = await this.db
        .select({
          date: sql`DATE_TRUNC('day', ${calls.createdAt})`,
          count: count(),
        })
        .from(calls)
        .where(and(eq(calls.orgId, orgId), gte(calls.createdAt, twoWeeksAgo)))
        .groupBy(sql`DATE_TRUNC('day', ${calls.createdAt})`)
        .orderBy(sql`DATE_TRUNC('day', ${calls.createdAt})`);

      // Determine trend
      const overallReachRateValue =
        overallReachRate?.total && overallReachRate.total > 0
          ? Number(overallReachRate.reached) / Number(overallReachRate.total)
          : 0;

      const weeklyReachRateValue =
        weeklyReachRate?.total && weeklyReachRate.total > 0
          ? Number(weeklyReachRate.reached) / Number(weeklyReachRate.total)
          : 0;

      const reachRateTrend =
        weeklyReachRateValue > overallReachRateValue * 1.05
          ? "up"
          : weeklyReachRateValue < overallReachRateValue * 0.95
            ? "down"
            : "stable";

      return {
        campaigns: {
          total: Number(campaignStats?.total || 0),
          active: Number(campaignStats?.active || 0),
        },
        calls: {
          total: Number(callStats?.total || 0),
          completed: Number(callStats?.completed || 0),
          inProgress: Number(callStats?.inProgress || 0),
          failed: Number(callStats?.failed || 0),
        },
        runs: {
          total: Number(runStats?.total || 0),
          active: Number(runStats?.active || 0),
          completed: Number(runStats?.completed || 0),
          scheduled: Number(runStats?.scheduled || 0),
        },
        reachRates: {
          overall: overallReachRateValue,
          lastWeek: weeklyReachRateValue,
          trend: reachRateTrend,
        },
        voicemailRates: {
          overall:
            overallVoicemailRate?.total && overallVoicemailRate.total > 0
              ? Number(overallVoicemailRate.voicemail) /
                Number(overallVoicemailRate.total)
              : 0,
          lastWeek:
            weeklyVoicemailRate?.total && weeklyVoicemailRate.total > 0
              ? Number(weeklyVoicemailRate.voicemail) /
                Number(weeklyVoicemailRate.total)
              : 0,
        },
        conversionRates: {
          overall:
            overallConversionRate?.total && overallConversionRate.total > 0
              ? Number(overallConversionRate.converted) /
                Number(overallConversionRate.total)
              : 0,
          lastWeek:
            weeklyConversionRate?.total && weeklyConversionRate.total > 0
              ? Number(weeklyConversionRate.converted) /
                Number(weeklyConversionRate.total)
              : 0,
        },
        callVolume: {
          byDay: callVolumeByDay.map((day) => ({
            date: formatDate(new Date(day.date as string), "yyyy-MM-dd"),
            count: Number(day.count),
          })),
        },
      };
    } catch (error) {
      console.error("Error getting org dashboard:", error);
      throw error;
    }
  }

  /**
   * Get detailed campaign analytics
   * @param campaignId Campaign ID
   */
  async getCampaignAnalytics(campaignId: string): Promise<{
    overview: {
      name: string;
      totalRuns: number;
      totalCalls: number;
      totalPatients: number;
      averageCallDuration: number;
      successRate: number;
    };
    callOutcomes: {
      reached: number;
      voicemail: number;
      notReached: number;
      failed: number;
    };
    conversionData: {
      converted: number;
      notConverted: number;
      conversionRate: number;
    };
    timeAnalysis: {
      bestTimeOfDay: { hour: number; rate: number; calls: number }[];
      bestDayOfWeek: { day: number; rate: number; calls: number }[];
    };
    callsByRun: {
      runId: string;
      runName: string;
      callCount: number;
      successRate: number;
      conversionRate: number;
    }[];
  }> {
    try {
      // Get campaign details
      const [campaign] = await this.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, campaignId));

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Get overview metrics
      const [overview] = await this.db
        .select({
          totalRuns: count(runs.id),
          totalCalls: sql`(SELECT COUNT(*) FROM ${calls} 
                              WHERE ${calls.campaignId} = ${campaignId})`,
          totalPatients: sql`COUNT(DISTINCT ${calls.patientId})`,
          averageCallDuration: sql`AVG(
                                      CASE 
                                        WHEN ${calls.analysis}->>'duration' IS NOT NULL 
                                        THEN (${calls.analysis}->>'duration')::int 
                                        ELSE 0 
                                      END)`,
          successRate: sql`ROUND(
                              COUNT(CASE WHEN ${calls.status} = 'completed' AND 
                              ${calls.analysis}->>'patient_reached' = 'true' THEN 1 END) * 100.0 / 
                              NULLIF(COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END), 0)
                            )`,
        })
        .from(calls)
        .where(eq(calls.campaignId, campaignId));

      // Call outcomes
      const [outcomes] = await this.db
        .select({
          reached: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND 
                              ${calls.analysis}->>'patient_reached' = 'true' THEN 1 END)`,
          voicemail: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND 
                              ${calls.analysis}->>'left_voicemail' = 'true' THEN 1 END)`,
          notReached: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND 
                              ${calls.analysis}->>'patient_reached' = 'false' AND 
                              ${calls.analysis}->>'left_voicemail' = 'false' THEN 1 END)`,
          failed: sql`COUNT(CASE WHEN ${calls.status} = 'failed' OR 
                              ${calls.error} IS NOT NULL THEN 1 END)`,
        })
        .from(calls)
        .where(eq(calls.campaignId, campaignId));

      // Conversion data
      const [conversions] = await this.db
        .select({
          converted: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND 
                              ${calls.analysis}->>'conversion' = 'true' THEN 1 END)`,
          notConverted: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND 
                              (${calls.analysis}->>'conversion' IS NULL OR ${calls.analysis}->>'conversion' = 'false') THEN 1 END)`,
          conversionRate: sql`ROUND(
                              COUNT(CASE WHEN ${calls.status} = 'completed' AND 
                              ${calls.analysis}->>'conversion' = 'true' THEN 1 END) * 100.0 / 
                              NULLIF(COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END), 0)
                            )`,
        })
        .from(calls)
        .where(eq(calls.campaignId, campaignId));

      // Time analysis - best time of day
      const bestTimeOfDay = await this.db
        .select({
          hour: sql`EXTRACT(HOUR FROM ${calls.createdAt})`,
          success: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND 
                              ${calls.analysis}->>'patient_reached' = 'true' THEN 1 END)`,
          total: sql`COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
        })
        .from(calls)
        .where(eq(calls.campaignId, campaignId))
        .groupBy(sql`EXTRACT(HOUR FROM ${calls.createdAt})`)
        .orderBy(sql`EXTRACT(HOUR FROM ${calls.createdAt})`);

      // Time analysis - best day of week
      const bestDayOfWeek = await this.db
        .select({
          day: sql`EXTRACT(DOW FROM ${calls.createdAt})`,
          success: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND 
                              ${calls.analysis}->>'patient_reached' = 'true' THEN 1 END)`,
          total: sql`COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
        })
        .from(calls)
        .where(eq(calls.campaignId, campaignId))
        .groupBy(sql`EXTRACT(DOW FROM ${calls.createdAt})`)
        .orderBy(sql`EXTRACT(DOW FROM ${calls.createdAt})`);

      // Calls by run
      const callsByRun = await this.db
        .select({
          runId: runs.id,
          runName: runs.name,
          callCount: count(calls.id),
          successCount: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND 
                              ${calls.analysis}->>'patient_reached' = 'true' THEN 1 END)`,
          totalCompleted: sql`COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
          conversionCount: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND 
                              ${calls.analysis}->>'conversion' = 'true' THEN 1 END)`,
        })
        .from(runs)
        .leftJoin(calls, eq(calls.runId, runs.id))
        .where(eq(runs.campaignId, campaignId))
        .groupBy(runs.id, runs.name)
        .orderBy(desc(runs.createdAt));

      return {
        overview: {
          name: campaign.name,
          totalRuns: Number(overview?.totalRuns || 0),
          totalCalls: Number(overview?.totalCalls || 0),
          totalPatients: Number(overview?.totalPatients || 0),
          averageCallDuration: Number(overview?.averageCallDuration || 0),
          successRate: Number(overview?.successRate || 0),
        },
        callOutcomes: {
          reached: Number(outcomes?.reached || 0),
          voicemail: Number(outcomes?.voicemail || 0),
          notReached: Number(outcomes?.notReached || 0),
          failed: Number(outcomes?.failed || 0),
        },
        conversionData: {
          converted: Number(conversions?.converted || 0),
          notConverted: Number(conversions?.notConverted || 0),
          conversionRate: Number(conversions?.conversionRate || 0),
        },
        timeAnalysis: {
          bestTimeOfDay: bestTimeOfDay.map((hour) => ({
            hour: Number(hour.hour),
            rate:
              Number(hour.total) > 0
                ? Number(hour.success) / Number(hour.total)
                : 0,
            calls: Number(hour.total),
          })),
          bestDayOfWeek: bestDayOfWeek.map((day) => ({
            day: Number(day.day),
            rate:
              Number(day.total) > 0
                ? Number(day.success) / Number(day.total)
                : 0,
            calls: Number(day.total),
          })),
        },
        callsByRun: callsByRun.map((run) => ({
          runId: run.runId,
          runName: run.runName,
          callCount: Number(run.callCount),
          successRate:
            Number(run.totalCompleted) > 0
              ? (Number(run.successCount) / Number(run.totalCompleted)) * 100
              : 0,
          conversionRate:
            Number(run.totalCompleted) > 0
              ? (Number(run.conversionCount) / Number(run.totalCompleted)) * 100
              : 0,
        })),
      };
    } catch (error) {
      console.error("Error getting campaign analytics:", error);
      throw error;
    }
  }

  /**
   * Get detailed run analytics
   * @param runId Run ID
   */
  async getRunAnalytics(runId: string): Promise<{
    overview: {
      name: string;
      campaignName: string;
      status: string;
      totalRows: number;
      completedCalls: number;
      pendingCalls: number;
      failedCalls: number;
      startTime: string;
      endTime: string;
      duration: number;
    };
    callMetrics: {
      patientsReached: number;
      voicemailsLeft: number;
      noAnswer: number;
      averageCallDuration: number;
      conversionRate: number;
    };
    callTimeline: {
      time: string;
      status: "completed" | "failed" | "in-progress";
      reached: boolean;
    }[];
    analysis: {
      field: string;
      value: string;
      count: number;
      percentage: number;
    }[];
  }> {
    try {
      // Get run details
      const [run] = await this.db
        .select({
          run: runs,
          campaignName: campaigns.name,
        })
        .from(runs)
        .leftJoin(campaigns, eq(campaigns.id, runs.campaignId))
        .where(eq(runs.id, runId));

      if (!run?.run) {
        throw new Error(`Run ${runId} not found`);
      }

      // Row counts
      const [rowCounts] = await this.db
        .select({
          totalRows: count(),
          pending: sql`COUNT(CASE WHEN ${rowsTable.status} = 'pending' THEN 1 END)`,
          calling: sql`COUNT(CASE WHEN ${rowsTable.status} = 'calling' THEN 1 END)`,
          completed: sql`COUNT(CASE WHEN ${rowsTable.status} = 'completed' THEN 1 END)`,
          failed: sql`COUNT(CASE WHEN ${rowsTable.status} = 'failed' THEN 1 END)`,
        })
        .from(rowsTable)
        .where(eq(rowsTable.runId, runId));

      // Call metrics
      const [callMetrics] = await this.db
        .select({
          patientsReached: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'patient_reached' = 'true' THEN 1 END)`,
          voicemailsLeft: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'left_voicemail' = 'true' THEN 1 END)`,
          noAnswer: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'patient_reached' = 'false' AND ${calls.analysis}->>'left_voicemail' = 'false' THEN 1 END)`,
          averageCallDuration: avg(
            sql`CAST(${calls.analysis}->>'duration' AS INTEGER)`,
          ),
          conversionCount: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'conversion' = 'true' THEN 1 END)`,
          completedCount: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
        })
        .from(calls)
        .where(eq(calls.runId, runId));

      // Call timeline
      const callTimeline = await this.db
        .select({
          time: calls.createdAt,
          status: calls.status,
          reached: sql`${calls.analysis}->>'patient_reached' = 'true'`,
        })
        .from(calls)
        .where(eq(calls.runId, runId))
        .orderBy(calls.createdAt);

      // Get post-call data fields
      const analysisFields = await this.db
        .select({
          field: sql`key`,
          value: sql`value`,
          count: sql`COUNT(*)`,
        })
        .from(calls)
        .leftJoin(sql`jsonb_each_text(${calls.analysis})`, sql`true`)
        .where(
          and(
            eq(calls.runId, runId),
            eq(calls.status, "completed"),
            sql`key != 'patient_reached' AND key != 'left_voicemail'`,
          ),
        )
        .groupBy(sql`key`, sql`value`)
        .orderBy(sql`key`, sql`COUNT(*) DESC`);

      // Calculate duration
      let duration = 0;
      if (run.run.metadata?.run?.startTime && run.run.metadata?.run?.endTime) {
        const startTime = new Date(run.run.metadata.run.startTime).getTime();
        const endTime = new Date(run.run.metadata.run.endTime).getTime();
        duration = Math.floor((endTime - startTime) / 1000); // in seconds
      } else if (run.run.metadata?.run?.duration) {
        duration = run.run.metadata.run.duration;
      }

      // Organize post-call data by field
      const fieldGroups: Record<string, { value: string; count: number }[]> =
        {};

      analysisFields.forEach((field) => {
        const fieldName = field.field as string;
        if (!fieldGroups[fieldName]) {
          fieldGroups[fieldName] = [];
        }
        fieldGroups[fieldName].push({
          value: field.value as string,
          count: Number(field.count),
        });
      });

      // Calculate percentages and flatten
      const analysisFlat = Object.entries(fieldGroups).flatMap(
        ([field, values]) => {
          const totalForField = values.reduce(
            (sum, item) => sum + item.count,
            0,
          );
          return values.map((item) => ({
            field,
            value: item.value,
            count: item.count,
            percentage:
              totalForField > 0 ? (item.count / totalForField) * 100 : 0,
          }));
        },
      );

      return {
        overview: {
          name: run.run.name,
          campaignName: run.campaignName || "Unknown Campaign",
          status: run.run.status,
          totalRows: Number(rowCounts?.totalRows || 0),
          completedCalls: Number(rowCounts?.completed || 0),
          pendingCalls:
            Number(rowCounts?.pending || 0) + Number(rowCounts?.calling || 0),
          failedCalls: Number(rowCounts?.failed || 0),
          startTime:
            run.run.metadata?.run?.startTime || run.run.createdAt.toISOString(),
          endTime: run.run.metadata?.run?.endTime || "",
          duration,
        },
        callMetrics: {
          patientsReached: Number(callMetrics?.patientsReached || 0),
          voicemailsLeft: Number(callMetrics?.voicemailsLeft || 0),
          noAnswer: Number(callMetrics?.noAnswer || 0),
          averageCallDuration: Number(callMetrics?.averageCallDuration || 0),
          conversionRate: callMetrics?.completedCount
            ? (Number(callMetrics.conversionCount) /
                Number(callMetrics.completedCount)) *
              100
            : 0,
        },
        callTimeline: callTimeline.map((call) => ({
          time: call.time.toISOString(),
          status: call.status as "completed" | "failed" | "in-progress",
          reached: Boolean(call.reached),
        })),
        analysis: analysisFlat,
      };
    } catch (error) {
      console.error("Error getting run analytics:", error);
      throw error;
    }
  }

  /**
   * Get call analytics by time
   * @param orgId Organization ID
   * @param period Time period for analysis (day, week, month)
   * @param timezone Organization timezone
   */
  async getCallAnalyticsByTime(
    orgId: string,
    period: "day" | "week" | "month" = "week",
    timezone: string = "America/New_York",
  ): Promise<{
    byHourOfDay: {
      hour: number;
      total: number;
      reached: number;
      rate: number;
    }[];
    byDayOfWeek: {
      day: number;
      name: string;
      total: number;
      reached: number;
      rate: number;
    }[];
    recentTrend: {
      date: string;
      total: number;
      reached: number;
      rate: number;
    }[];
  }> {
    try {
      // Get organization timezone if not provided
      if (!timezone) {
        const [org] = await this.db
          .select({ timezone: organizations.timezone })
          .from(organizations)
          .where(eq(organizations.id, orgId));

        timezone = org?.timezone || "America/New_York";
      }

      // Set date range based on period
      let startDate: Date;
      const endDate = new Date();

      switch (period) {
        case "day":
          startDate = subDays(endDate, 1);
          break;
        case "month":
          startDate = subMonths(endDate, 1);
          break;
        case "week":
        default:
          startDate = subDays(endDate, 7);
          break;
      }

      // Convert dates to ISO strings for SQL
      const startDateString = startDate.toISOString();
      const endDateString = endDate.toISOString();

      // By hour of day query
      const byHourOfDay = await this.db.execute(sql`
            SELECT 
              EXTRACT(HOUR FROM "rivvi_call"."created_at" AT TIME ZONE ${timezone}) AS hour,
              COUNT(*) AS total,
              COUNT(CASE WHEN "rivvi_call"."status" = 'completed' AND "rivvi_call"."analysis"->>'patient_reached' = 'true' THEN 1 END) AS reached
            FROM "rivvi_call"
            WHERE 
              "rivvi_call"."org_id" = ${orgId} AND
              "rivvi_call"."created_at" >= ${startDateString}::timestamp AND
              "rivvi_call"."created_at" < ${endDateString}::timestamp
            GROUP BY hour
            ORDER BY hour
          `);

      // By day of week query
      const byDayOfWeek = await this.db.execute(sql`
            SELECT 
              EXTRACT(DOW FROM "rivvi_call"."created_at" AT TIME ZONE ${timezone}) AS day,
              COUNT(*) AS total,
              COUNT(CASE WHEN "rivvi_call"."status" = 'completed' AND "rivvi_call"."analysis"->>'patient_reached' = 'true' THEN 1 END) AS reached
            FROM "rivvi_call"
            WHERE 
              "rivvi_call"."org_id" = ${orgId} AND
              "rivvi_call"."created_at" >= ${startDateString}::timestamp AND
              "rivvi_call"."created_at" < ${endDateString}::timestamp
            GROUP BY day
            ORDER BY day
          `);

      // Recent trend query
      const dateFormat = period === "day" ? "hour" : "day";
      const recentTrend = await this.db.execute(sql`
            SELECT 
              DATE_TRUNC('${sql.raw(dateFormat)}', "rivvi_call"."created_at" AT TIME ZONE ${timezone}) AS date,
              COUNT(*) AS total,
              COUNT(CASE WHEN "rivvi_call"."status" = 'completed' AND "rivvi_call"."analysis"->>'patient_reached' = 'true' THEN 1 END) AS reached
            FROM "rivvi_call"
            WHERE 
              "rivvi_call"."org_id" = ${orgId} AND
              "rivvi_call"."created_at" >= ${startDateString}::timestamp AND
              "rivvi_call"."created_at" < ${endDateString}::timestamp
            GROUP BY date
            ORDER BY date
          `);

      // Day of week names
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      // Convert SQL results to the expected format safely
      return {
        byHourOfDay: (
          byHourOfDay as unknown as Array<Record<string, unknown>>
        ).map((hour) => ({
          hour: Number(hour.hour),
          total: Number(hour.total),
          reached: Number(hour.reached),
          rate:
            Number(hour.total) > 0
              ? Number(hour.reached) / Number(hour.total)
              : 0,
        })),
        byDayOfWeek: (
          byDayOfWeek as unknown as Array<Record<string, unknown>>
        ).map((day) => ({
          day: Number(day.day),
          name: dayNames[Number(day.day)] ?? "Unknown",
          total: Number(day.total),
          reached: Number(day.reached),
          rate:
            Number(day.total) > 0 ? Number(day.reached) / Number(day.total) : 0,
        })),
        recentTrend: (
          recentTrend as unknown as Array<Record<string, unknown>>
        ).map((trend) => ({
          date: formatDate(
            new Date(trend.date as string),
            period === "day" ? "yyyy-MM-dd HH:00" : "yyyy-MM-dd",
          ),
          total: Number(trend.total),
          reached: Number(trend.reached),
          rate:
            Number(trend.total) > 0
              ? Number(trend.reached) / Number(trend.total)
              : 0,
        })),
      };
    } catch (error) {
      console.error("Error getting call analytics by time:", error);
      throw error;
    }
  }

  /**
   * Generate reports for export (CSV)
   * @param params Report parameters
   */
  async generateReport(params: {
    orgId: string;
    reportType: "calls" | "campaigns" | "runs" | "patients";
    startDate?: Date;
    endDate?: Date;
    campaignId?: string;
    runId?: string;
    format?: "csv" | "json";
  }): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
    try {
      const {
        orgId,
        reportType,
        startDate = subMonths(new Date(), 1),
        endDate = new Date(),
        campaignId,
        runId,
        format = "csv",
      } = params;

      let headers: string[] = [];
      let rows: Record<string, any>[] = [];

      switch (reportType) {
        case "calls": {
          // Call report
          const callsData = await this.db
            .select({
              callId: calls.id,
              campaignName: campaigns.name,
              runName: runs.name,
              direction: calls.direction,
              status: calls.status,
              createdAt: calls.createdAt,
              patientReached: sql`${calls.analysis}->>'patient_reached'`,
              leftVoicemail: sql`${calls.analysis}->>'left_voicemail'`,
              duration: sql`${calls.analysis}->>'duration'`,
              toNumber: calls.toNumber,
              fromNumber: calls.fromNumber,
              // Additional post-call data would be extracted separately
            })
            .from(calls)
            .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
            .leftJoin(runs, eq(calls.runId, runs.id))
            .where(
              and(
                eq(calls.orgId, orgId),
                campaignId ? eq(calls.campaignId, campaignId) : undefined,
                runId ? eq(calls.runId, runId) : undefined,
                gte(calls.createdAt, startDate),
                lt(calls.createdAt, endDate),
              ),
            )
            .orderBy(desc(calls.createdAt));

          // Extract additional post-call data for each call
          const callsWithanalysis = await Promise.all(
            callsData.map(async (call) => {
              // Flatten call data
              const flatCall = {
                "Call ID": call.callId,
                Campaign: call.campaignName,
                Run: call.runName,
                Direction: call.direction,
                Status: call.status,
                Date: formatDate(call.createdAt, "yyyy-MM-dd HH:mm:ss"),
                "Patient Reached":
                  call.patientReached === "true" ? "Yes" : "No",
                "Left Voicemail": call.leftVoicemail === "true" ? "Yes" : "No",
                "Duration (seconds)": call.duration,
                "To Number": call.toNumber,
                "From Number": call.fromNumber,
              };

              // Get all post-call data fields for this call
              const [callDetails] = await this.db
                .select({
                  analysis: calls.analysis,
                })
                .from(calls)
                .where(eq(calls.id, call.callId));

              // Add post-call fields
              const analysis = callDetails?.analysis || {};
              for (const [key, value] of Object.entries(analysis)) {
                if (key !== "patient_reached" && key !== "left_voicemail") {
                  (flatCall as Record<string, unknown>)[`Analysis: ${key}`] =
                    value;
                }
              }

              return flatCall;
            }),
          );

          // Set headers and rows
          if (callsWithanalysis.length > 0) {
            headers = Object.keys(callsWithanalysis[0] as Record<string, any>);
          }
          rows = callsWithanalysis;
          break;
        }

        case "campaigns": {
          // Campaign performance report
          const campaignsData = await this.db
            .select({
              campaignId: campaigns.id,
              campaignName: campaigns.name,
              totalRuns: sql<number>`COUNT(DISTINCT ${runs.id})`,
              totalCalls: count(calls.id),
              completedCalls: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
              patientsReached: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'patient_reached' = 'true' THEN 1 END)`,
              voicemailsLeft: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'left_voicemail' = 'true' THEN 1 END)`,
              conversions: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'conversion' = 'true' THEN 1 END)`,
              avgDuration: avg(
                sql`CAST(${calls.analysis}->>'duration' AS INTEGER)`,
              ),
              createdAt: campaigns.createdAt,
            })
            .from(campaigns)
            .leftJoin(runs, eq(runs.campaignId, campaigns.id))
            .leftJoin(calls, eq(calls.campaignId, campaigns.id))
            .where(
              and(
                eq(campaigns.orgId, orgId),
                campaignId ? eq(campaigns.id, campaignId) : undefined,
                calls.createdAt ? gte(calls.createdAt, startDate) : undefined,
                calls.createdAt ? lt(calls.createdAt, endDate) : undefined,
              ),
            )
            .groupBy(campaigns.id, campaigns.name, campaigns.createdAt)
            .orderBy(desc(campaigns.createdAt));

          // Format data for CSV
          rows = campaignsData.map((campaign) => {
            const completedCount = Number(campaign.completedCalls);
            const reachedCount = Number(campaign.patientsReached);
            const conversionCount = Number(campaign.conversions);

            return {
              "Campaign ID": campaign.campaignId,
              "Campaign Name": campaign.campaignName,
              "Total Runs": Number(campaign.totalRuns),
              "Total Calls": Number(campaign.totalCalls),
              "Completed Calls": completedCount,
              "Reach Rate (%)":
                completedCount > 0
                  ? ((reachedCount / completedCount) * 100).toFixed(2)
                  : "0.00",
              "Patients Reached": reachedCount,
              "Voicemails Left": Number(campaign.voicemailsLeft),
              Conversions: conversionCount,
              "Conversion Rate (%)":
                completedCount > 0
                  ? ((conversionCount / completedCount) * 100).toFixed(2)
                  : "0.00",
              "Avg Call Duration (sec)": Number(campaign.avgDuration) || 0,
              "Created At": formatDate(campaign.createdAt, "yyyy-MM-dd"),
            };
          });

          if (rows.length > 0) {
            headers = Object.keys(rows[0] as Record<string, any>);
          }
          break;
        }

        case "runs": {
          // Runs report
          const runsData = await this.db
            .select({
              runId: runs.id,
              runName: runs.name,
              campaignName: campaigns.name,
              status: runs.status,
              createdAt: runs.createdAt,
              updatedAt: runs.updatedAt,
              totalRows: sql`(SELECT COUNT(*) FROM ${rowsTable} WHERE ${rowsTable.runId} = ${runs.id})`,
              completedCalls: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
              totalCalls: count(calls.id),
              patientsReached: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'patient_reached' = 'true' THEN 1 END)`,
              voicemailsLeft: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'left_voicemail' = 'true' THEN 1 END)`,
              conversions: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'conversion' = 'true' THEN 1 END)`,
              failedCalls: sql<number>`COUNT(CASE WHEN ${calls.status} = 'failed' OR ${calls.error} IS NOT NULL THEN 1 END)`,
            })
            .from(runs)
            .leftJoin(campaigns, eq(runs.campaignId, campaigns.id))
            .leftJoin(calls, eq(calls.runId, runs.id))
            .where(
              and(
                eq(runs.orgId, orgId),
                campaignId ? eq(runs.campaignId, campaignId) : undefined,
                runId ? eq(runs.id, runId) : undefined,
                gte(runs.createdAt, startDate),
                lt(runs.createdAt, endDate),
              ),
            )
            .groupBy(
              runs.id,
              runs.name,
              campaigns.name,
              runs.status,
              runs.createdAt,
              runs.updatedAt,
            )
            .orderBy(desc(runs.createdAt));

          // Format data for CSV
          rows = runsData.map((run) => {
            const completedCount = Number(run.completedCalls);
            const reachedCount = Number(run.patientsReached);
            const conversionCount = Number(run.conversions);

            return {
              "Run ID": run.runId,
              "Run Name": run.runName,
              Campaign: run.campaignName,
              Status: run.status,
              "Created At": formatDate(run.createdAt, "yyyy-MM-dd HH:mm:ss"),
              "Updated At": run.updatedAt
                ? formatDate(run.updatedAt, "yyyy-MM-dd HH:mm:ss")
                : "",
              "Total Rows": Number(run.totalRows),
              "Total Calls": Number(run.totalCalls),
              "Completed Calls": completedCount,
              "Failed Calls": Number(run.failedCalls),
              "Patients Reached": reachedCount,
              "Reach Rate (%)":
                completedCount > 0
                  ? ((reachedCount / completedCount) * 100).toFixed(2)
                  : "0.00",
              "Voicemails Left": Number(run.voicemailsLeft),
              Conversions: conversionCount,
              "Conversion Rate (%)":
                completedCount > 0
                  ? ((conversionCount / completedCount) * 100).toFixed(2)
                  : "0.00",
            };
          });

          if (rows.length > 0) {
            headers = Object.keys(rows[0] as Record<string, any>);
          }
          break;
        }

        case "patients": {
          // Patient communication history report
          const patientsData = await this.db
            .select({
              patientId: calls.patientId,
              firstName: sql`(SELECT "firstName" FROM ${patients} WHERE id = ${calls.patientId})`,
              lastName: sql`(SELECT "lastName" FROM ${patients} WHERE id = ${calls.patientId})`,
              phone: calls.toNumber,
              totalCalls: count(),
              lastCallDate: sql`MAX(${calls.createdAt})`,
              patientsReached: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'patient_reached' = 'true' THEN 1 END)`,
              voicemailsLeft: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'left_voicemail' = 'true' THEN 1 END)`,
              conversions: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' AND ${calls.analysis}->>'conversion' = 'true' THEN 1 END)`,
            })
            .from(calls)
            .where(
              and(
                eq(calls.orgId, orgId),
                sql`${calls.patientId} IS NOT NULL`,
                campaignId ? eq(calls.campaignId, campaignId) : undefined,
                runId ? eq(calls.runId, runId) : undefined,
                gte(calls.createdAt, startDate),
                lt(calls.createdAt, endDate),
              ),
            )
            .groupBy(calls.patientId, calls.toNumber)
            .orderBy(desc(sql`MAX(${calls.createdAt})`));

          // Format data for CSV
          rows = patientsData.map((patient) => {
            const totalCalls = Number(patient.totalCalls);
            const reachedCount = Number(patient.patientsReached);
            const conversionCount = Number(patient.conversions);

            return {
              "Patient ID": patient.patientId,
              "First Name": patient.firstName,
              "Last Name": patient.lastName,
              "Phone Number": patient.phone,
              "Total Calls": totalCalls,
              "Calls Where Reached": reachedCount,
              "Reach Rate (%)":
                totalCalls > 0
                  ? ((reachedCount / totalCalls) * 100).toFixed(2)
                  : "0.00",
              "Voicemails Left": Number(patient.voicemailsLeft),
              Conversions: conversionCount,
              "Conversion Rate (%)":
                totalCalls > 0
                  ? ((conversionCount / totalCalls) * 100).toFixed(2)
                  : "0.00",
              "Last Call Date": patient.lastCallDate
                ? formatDate(
                    patient.lastCallDate as string,
                    "yyyy-MM-dd HH:mm:ss",
                  )
                : "",
            };
          });

          if (rows.length > 0) {
            headers = Object.keys(rows[0] as Record<string, any>);
          }
          break;
        }
      }

      return { headers, rows };
    } catch (error) {
      console.error("Error generating report:", error);
      throw error;
    }
  }
}
