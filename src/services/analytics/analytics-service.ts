// src/services/analytics/analytics-service.ts
import {
  createError,
  createSuccess,
  ServiceResult,
} from "@/lib/service-result";
import { db } from "@/server/db";
import {
  calls,
  campaigns,
  organizations,
  patients,
  rows,
  runs,
} from "@/server/db/schema";
import { formatISO, subDays, subMonths } from "date-fns";
import { and, avg, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  CampaignAnalytics,
  DashboardStats,
  OrgDashboardData,
  RunAnalytics,
  TimeBasedAnalytics,
} from "./types";

/**
 * Comprehensive analytics service for the entire application
 */
export function createAnalyticsService(dbInstance = db) {
  return {
    /**
     * Get organization-level dashboard statistics
     */
    async getDashboardStats(
      orgId: string,
    ): Promise<ServiceResult<DashboardStats>> {
      try {
        // Get campaign count
        const [campaignCount] = await dbInstance
          .select({ value: count() })
          .from(campaigns)
          .where(eq(campaigns.orgId, orgId));

        // Get active runs count
        const [activeRunsCount] = await dbInstance
          .select({ value: count() })
          .from(runs)
          .where(
            and(
              eq(runs.orgId, orgId),
              sql`${runs.status} IN ('running', 'paused', 'scheduled')`,
            ),
          );

        // Get completed calls count
        const [completedCallsCount] = await dbInstance
          .select({ value: count() })
          .from(calls)
          .where(and(eq(calls.orgId, orgId), eq(calls.status, "completed")));

        // Get patients count
        const [patientsCount] = await dbInstance
          .select({ value: sql`COUNT(DISTINCT ${patients.id})` })
          .from(patients)
          .innerJoin(calls, eq(patients.id, calls.patientId))
          .where(eq(calls.orgId, orgId));

        // Call success rate
        const [successRate] = await dbInstance
          .select({
            completed: sql`COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
            connected: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND 
                               (${calls.analysis}->>'patient_reached')::text = 'true' THEN 1 END)`,
          })
          .from(calls)
          .where(eq(calls.orgId, orgId));

        // Calculate rate
        const connected = Number(successRate?.connected || 0);
        const completed = Number(successRate?.completed || 0);
        const rate = completed > 0 ? (connected / completed) * 100 : 0;

        return createSuccess({
          counts: {
            campaigns: Number(campaignCount?.value || 0),
            activeRuns: Number(activeRunsCount?.value || 0),
            completedCalls: Number(completedCallsCount?.value || 0),
            patients: Number(patientsCount?.value || 0),
          },
          rates: {
            success: parseFloat(rate.toFixed(1)),
          },
          lastUpdated: new Date().toISOString(),
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

    /**
     * Get organization-level dashboard with charts and metrics
     */
    async getOrgDashboard(
      orgId: string,
    ): Promise<ServiceResult<OrgDashboardData>> {
      try {
        // Get call volume stats
        const [callVolume] = await dbInstance
          .select({
            total: count(),
            inbound: sql`SUM(CASE WHEN ${calls.direction} = 'inbound' THEN 1 ELSE 0 END)`,
            outbound: sql`SUM(CASE WHEN ${calls.direction} = 'outbound' THEN 1 ELSE 0 END)`,
            completed: sql`SUM(CASE WHEN ${calls.status} = 'completed' THEN 1 ELSE 0 END)`,
            failed: sql`SUM(CASE WHEN ${calls.status} = 'failed' THEN 1 ELSE 0 END)`,
            voicemail: sql`SUM(CASE WHEN ${calls.status} = 'voicemail' OR 
                              (${calls.analysis}->>'voicemail_left')::text = 'true' OR 
                              (${calls.analysis}->>'left_voicemail')::text = 'true' THEN 1 ELSE 0 END)`,
            connected: sql`SUM(CASE WHEN (${calls.analysis}->>'patient_reached')::text = 'true' OR 
                              (${calls.analysis}->>'patientReached')::text = 'true' THEN 1 ELSE 0 END)`,
            totalDuration: sql`SUM(${calls.duration})`,
            avgDuration: sql`AVG(${calls.duration})`,
          })
          .from(calls)
          .where(eq(calls.orgId, orgId));

        // Get call trends (last 14 days)
        const callTrends = await dbInstance
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
        const recentCalls = await dbInstance
          .select()
          .from(calls)
          .where(eq(calls.orgId, orgId))
          .orderBy(desc(calls.createdAt))
          .limit(10);

        // Get top campaigns by call volume
        const topCampaignsData = await dbInstance
          .select({
            id: campaigns.id,
            name: campaigns.name,
            callCount: count(),
            successCount: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
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

        // Get call outcomes by type
        const [callOutcomes] = await dbInstance
          .select({
            connected: sql`SUM(CASE WHEN (${calls.analysis}->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
            voicemail: sql`SUM(CASE WHEN (${calls.analysis}->>'left_voicemail')::text = 'true' OR
                             (${calls.analysis}->>'voicemail')::text = 'true' THEN 1 ELSE 0 END)`,
            missed: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND 
                             NOT((${calls.analysis}->>'patient_reached')::text = 'true') AND
                             NOT((${calls.analysis}->>'left_voicemail')::text = 'true') THEN 1 ELSE 0 END)`,
            failed: sql`SUM(CASE WHEN ${calls.status} = 'failed' THEN 1 ELSE 0 END)`,
          })
          .from(calls)
          .where(eq(calls.orgId, orgId));

        return createSuccess({
          callVolume: {
            total: Number(callVolume?.total || 0),
            inbound: Number(callVolume?.inbound || 0),
            outbound: Number(callVolume?.outbound || 0),
            completed: Number(callVolume?.completed || 0),
            failed: Number(callVolume?.failed || 0),
            voicemail: Number(callVolume?.voicemail || 0),
            connected: Number(callVolume?.connected || 0),
            avgDuration: Number(callVolume?.avgDuration || 0),
          },
          callTrends: callTrends.map((trend) => ({
            date: trend.date as string,
            count: Number(trend.count),
          })),
          callOutcomes: {
            connected: Number(callOutcomes?.connected || 0),
            voicemail: Number(callOutcomes?.voicemail || 0),
            missed: Number(callOutcomes?.missed || 0),
            failed: Number(callOutcomes?.failed || 0),
          },
          recentCalls: recentCalls.map((call) => ({
            ...this.formatDates(call),
            insights: this.extractInsights(call),
          })),
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
    },

    /**
     * Get call analytics by time (hour of day, day of week, etc.)
     */
    async getCallAnalyticsByTime(
      orgId: string,
      period: "day" | "week" | "month" = "week",
      timezone: string = "America/New_York",
      campaignId?: string,
    ): Promise<ServiceResult<TimeBasedAnalytics>> {
      try {
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

        // Base conditions
        const conditions = [eq(calls.orgId, orgId)];

        // Add date range
        conditions.push(gte(calls.createdAt, startDate));
        conditions.push(lte(calls.createdAt, endDate));

        // Add campaign filter if specified
        if (campaignId) {
          conditions.push(eq(calls.campaignId, campaignId));
        }

        // Use organization timezone if not specified
        if (!timezone) {
          const [org] = await dbInstance
            .select({ timezone: organizations.timezone })
            .from(organizations)
            .where(eq(organizations.id, orgId));

          timezone = org?.timezone || "America/New_York";
        }

        // By hour of day query for connections
        const byHourOfDay = await dbInstance
          .select({
            hour: sql`EXTRACT(HOUR FROM ${calls.startTime} AT TIME ZONE ${timezone})`,
            total: count(),
            reached: sql`SUM(CASE WHEN (${calls.analysis}->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
          })
          .from(calls)
          .where(and(...conditions, sql`${calls.startTime} IS NOT NULL`))
          .groupBy(
            sql`EXTRACT(HOUR FROM ${calls.startTime} AT TIME ZONE ${timezone})`,
          )
          .orderBy(
            sql`EXTRACT(HOUR FROM ${calls.startTime} AT TIME ZONE ${timezone})`,
          );

        // By day of week query
        const byDayOfWeek = await dbInstance
          .select({
            day: sql`EXTRACT(DOW FROM ${calls.startTime} AT TIME ZONE ${timezone})`,
            total: count(),
            reached: sql`SUM(CASE WHEN (${calls.analysis}->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
          })
          .from(calls)
          .where(and(...conditions, sql`${calls.startTime} IS NOT NULL`))
          .groupBy(
            sql`EXTRACT(DOW FROM ${calls.startTime} AT TIME ZONE ${timezone})`,
          )
          .orderBy(
            sql`EXTRACT(DOW FROM ${calls.startTime} AT TIME ZONE ${timezone})`,
          );

        // Call outcomes over time
        const dateFormat = period === "day" ? "hour" : "day";
        const callOutcomes = await dbInstance
          .select({
            date: sql`DATE_TRUNC('${sql.raw(dateFormat)}', ${calls.createdAt} AT TIME ZONE ${timezone})`,
            connected: sql`SUM(CASE WHEN (${calls.analysis}->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
            voicemail: sql`SUM(CASE WHEN (${calls.analysis}->>'left_voicemail')::text = 'true' OR
                                      (${calls.analysis}->>'voicemail')::text = 'true' THEN 1 ELSE 0 END)`,
            failed: sql`SUM(CASE WHEN ${calls.status} = 'failed' THEN 1 ELSE 0 END)`,
          })
          .from(calls)
          .where(and(...conditions))
          .groupBy(
            sql`DATE_TRUNC('${sql.raw(dateFormat)}', ${calls.createdAt} AT TIME ZONE ${timezone})`,
          )
          .orderBy(
            sql`DATE_TRUNC('${sql.raw(dateFormat)}', ${calls.createdAt} AT TIME ZONE ${timezone})`,
          );

        // Map day numbers to names
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];

        return createSuccess({
          byHourOfDay: byHourOfDay.map((hour) => ({
            hour: Number(hour.hour || 0),
            total: Number(hour.total || 0),
            reached: Number(hour.reached || 0),
            rate:
              Number(hour.total) > 0
                ? Number(hour.reached) / Number(hour.total)
                : 0,
          })),
          byDayOfWeek: byDayOfWeek.map((day) => ({
            day: Number(day.day || 0),
            name: dayNames[Number(day.day || 0)] || "Unknown",
            total: Number(day.total || 0),
            reached: Number(day.reached || 0),
            rate:
              Number(day.total) > 0
                ? Number(day.reached) / Number(day.total)
                : 0,
          })),
          callOutcomes: callOutcomes.map((outcome) => ({
            date: formatISO(new Date(outcome.date as string), {
              representation: "date",
            }),
            connected: Number(outcome.connected || 0),
            voicemail: Number(outcome.voicemail || 0),
            failed: Number(outcome.failed || 0),
          })),
          period,
          timezone,
          campaignId,
        });
      } catch (error) {
        console.error("Error getting call analytics by time:", error);
        return createError(
          "INTERNAL_ERROR",
          "Failed to fetch time-based analytics",
          error,
        );
      }
    },

    /**
     * Get detailed campaign analytics
     */
    async getCampaignAnalytics(
      campaignId: string,
    ): Promise<ServiceResult<CampaignAnalytics>> {
      try {
        // Get campaign details first
        const campaign = await dbInstance.query.campaigns.findFirst({
          where: eq(campaigns.id, campaignId),
          with: {
            template: true,
          },
        });

        if (!campaign) {
          return createError("NOT_FOUND", "Campaign not found");
        }

        // Get call metrics for the campaign
        const [callMetrics] = await dbInstance
          .select({
            total: count(),
            completed: sql`SUM(CASE WHEN ${calls.status} = 'completed' THEN 1 ELSE 0 END)`,
            failed: sql`SUM(CASE WHEN ${calls.status} = 'failed' THEN 1 ELSE 0 END)`,
            voicemail: sql`SUM(CASE WHEN ${calls.status} = 'voicemail' OR 
                              (${calls.analysis}->>'voicemail_left')::text = 'true' OR 
                              (${calls.analysis}->>'left_voicemail')::text = 'true' THEN 1 ELSE 0 END)`,
            inProgress: sql`SUM(CASE WHEN ${calls.status} = 'in-progress' THEN 1 ELSE 0 END)`,
            pending: sql`SUM(CASE WHEN ${calls.status} = 'pending' THEN 1 ELSE 0 END)`,
            success: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
          })
          .from(calls)
          .where(eq(calls.campaignId, campaignId));

        // Get analysis fields from campaign template
        const analysisFields =
          campaign.template?.[0]?.analysisConfig?.campaign?.fields || [];

        // Get conversion metrics for each analysis field
        const conversionMetrics = [];
        for (const field of analysisFields) {
          if (field.type === "boolean") {
            // For boolean fields, get true/false counts
            const [metrics] = await dbInstance
              .select({
                trueCount: sql`SUM(CASE WHEN (${calls.analysis}->>'${field.key}')::boolean = true THEN 1 ELSE 0 END)`,
                falseCount: sql`SUM(CASE WHEN (${calls.analysis}->>'${field.key}')::boolean = false THEN 1 ELSE 0 END)`,
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
                true: Number(metrics.trueCount || 0),
                false: Number(metrics.falseCount || 0),
              },
              total: Number(metrics.total || 0),
              rate:
                Number(metrics.total) > 0
                  ? (Number(metrics.trueCount) / Number(metrics.total)) * 100
                  : 0,
            });
          } else if (field.type === "enum" && field.options) {
            // For enum fields, get counts for each option
            const values: Record<string, number> = {};

            // Initialize with all options
            field.options.forEach((option) => {
              values[option] = 0;
            });

            // Get actual counts
            const optionCounts = await dbInstance
              .select({
                option: sql`${calls.analysis}->>'${field.key}'`,
                count: count(),
              })
              .from(calls)
              .where(
                and(
                  eq(calls.campaignId, campaignId),
                  eq(calls.status, "completed"),
                  sql`${calls.analysis}->>'${field.key}' IS NOT NULL`,
                ),
              )
              .groupBy(sql`${calls.analysis}->>'${field.key}'`);

            // Fill in actual counts
            optionCounts.forEach((result) => {
              if (result.option) {
                values[result.option as string] = Number(result.count || 0);
              }
            });

            // Get total completed calls for this field
            const [totalResult] = await dbInstance
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

            const total = Number(totalResult.total || 0);

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
        const runMetrics = await dbInstance
          .select({
            id: runs.id,
            name: runs.name,
            totalCalls: sql`COUNT(${calls.id})`,
            completedCalls: sql`SUM(CASE WHEN ${calls.status} = 'completed' THEN 1 ELSE 0 END)`,
            successCalls: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
          })
          .from(runs)
          .leftJoin(calls, eq(calls.runId, runs.id))
          .where(eq(runs.campaignId, campaignId))
          .groupBy(runs.id, runs.name)
          .orderBy(desc(runs.createdAt))
          .limit(10);

        return createSuccess({
          campaign: {
            id: campaign.id,
            name: campaign.name,
            direction: campaign.direction,
          },
          callMetrics: {
            total: Number(callMetrics?.total || 0),
            completed: Number(callMetrics?.completed || 0),
            failed: Number(callMetrics?.failed || 0),
            voicemail: Number(callMetrics?.voicemail || 0),
            inProgress: Number(callMetrics?.inProgress || 0),
            pending: Number(callMetrics?.pending || 0),
            successRate:
              Number(callMetrics?.completed) > 0
                ? (Number(callMetrics?.success) /
                    Number(callMetrics?.completed)) *
                  100
                : 0,
          },
          conversionMetrics,
          runMetrics: runMetrics.map((run) => ({
            id: run.id,
            name: run.name,
            totalCalls: Number(run.totalCalls || 0),
            completedCalls: Number(run.completedCalls || 0),
            conversionRate:
              Number(run.completedCalls) > 0
                ? (Number(run.successCalls) / Number(run.completedCalls)) * 100
                : 0,
          })),
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error getting campaign analytics:", error);
        return createError(
          "INTERNAL_ERROR",
          "Failed to fetch campaign analytics",
          error,
        );
      }
    },

    /**
     * Get detailed run analytics
     */
    async getRunAnalytics(runId: string): Promise<ServiceResult<RunAnalytics>> {
      try {
        // Get run details with related campaign
        const run = await dbInstance.query.runs.findFirst({
          where: eq(runs.id, runId),
          with: {
            campaign: true,
          },
        });

        if (!run) {
          return createError("NOT_FOUND", "Run not found");
        }

        // Row counts by status
        const [rowCounts] = await dbInstance
          .select({
            totalRows: count(),
            pending: sql`COUNT(CASE WHEN ${rows.status} = 'pending' THEN 1 END)`,
            calling: sql`COUNT(CASE WHEN ${rows.status} = 'calling' THEN 1 END)`,
            completed: sql`COUNT(CASE WHEN ${rows.status} = 'completed' THEN 1 END)`,
            failed: sql`COUNT(CASE WHEN ${rows.status} = 'failed' THEN 1 END)`,
            skipped: sql`COUNT(CASE WHEN ${rows.status} = 'skipped' THEN 1 END)`,
          })
          .from(rows)
          .where(eq(rows.runId, runId));

        // Call metrics
        const [callMetrics] = await dbInstance
          .select({
            patientsReached: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}->>'patient_reached')::text = 'true' THEN 1 END)`,
            voicemailsLeft: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}->>'left_voicemail')::text = 'true' THEN 1 END)`,
            noAnswer: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}->>'patient_reached')::text = 'false' AND (${calls.analysis}->>'left_voicemail')::text = 'false' THEN 1 END)`,
            averageCallDuration: avg(
              sql`CAST(${calls.analysis}->>'duration' AS INTEGER)`,
            ),
            conversionCount: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}->>'conversion')::text = 'true' THEN 1 END)`,
            completedCount: sql`COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
          })
          .from(calls)
          .where(eq(calls.runId, runId));

        // Call timeline
        const callTimeline = await dbInstance
          .select({
            time: calls.createdAt,
            status: calls.status,
            reached: sql`(${calls.analysis}->>'patient_reached')::text = 'true'`,
          })
          .from(calls)
          .where(eq(calls.runId, runId))
          .orderBy(calls.createdAt);

        // Calculate duration
        let duration = 0;
        if (run.metadata?.run?.startTime && run.metadata?.run?.endTime) {
          const startTime = new Date(
            run.metadata.run.startTime as string,
          ).getTime();
          const endTime = new Date(
            run.metadata.run.endTime as string,
          ).getTime();
          duration = Math.floor((endTime - startTime) / 1000); // in seconds
        } else if (run.metadata?.run?.duration) {
          duration = run.metadata.run.duration as number;
        }

        // Get post-call analysis data
        const analysisFields = await dbInstance
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

        // Organize data by field
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

        return createSuccess({
          overview: {
            name: run.name,
            campaignName: run.campaign?.[0]?.name || "Unknown Campaign",
            status: run.status,
            totalRows: Number(rowCounts?.totalRows || 0),
            completedCalls: Number(rowCounts?.completed || 0),
            pendingCalls:
              Number(rowCounts?.pending || 0) + Number(rowCounts?.calling || 0),
            failedCalls: Number(rowCounts?.failed || 0),
            startTime:
              (run.metadata?.run?.startTime as string) ||
              run.createdAt.toISOString(),
            endTime: (run.metadata?.run?.endTime as string) || "",
            duration,
          },
          callMetrics: {
            patientsReached: Number(callMetrics?.patientsReached || 0),
            voicemailsLeft: Number(callMetrics?.voicemailsLeft || 0),
            noAnswer: Number(callMetrics?.noAnswer || 0),
            averageCallDuration: Number(callMetrics?.averageCallDuration || 0),
            conversionRate: Number(callMetrics?.completedCount)
              ? (Number(callMetrics.conversionCount) /
                  Number(callMetrics.completedCount)) *
                100
              : 0,
          },
          callTimeline: callTimeline.map((call) => ({
            time: call.time.toISOString(),
            status: call.status,
            reached: Boolean(call.reached),
          })),
          analysis: analysisFlat,
        });
      } catch (error) {
        console.error("Error getting run analytics:", error);
        return createError(
          "INTERNAL_ERROR",
          "Failed to fetch run analytics",
          error,
        );
      }
    },

    /**
     * Helper to convert date objects to ISO strings
     */
    formatDates<T extends Record<string, any>>(record: T): T {
      const result = { ...record } as Record<string, any>;

      // Convert Date objects to ISO strings for specific fields
      const dateFields = [
        "createdAt",
        "updatedAt",
        "nextRetryTime",
        "startTime",
        "endTime",
      ];

      for (const field of dateFields) {
        if (result[field] instanceof Date) {
          result[field] = result[field].toISOString();
        }
      }

      return result as T;
    },

    /**
     * Extract insights from a call
     */
    extractInsights(call: typeof calls.$inferSelect) {
      const analysis = call.analysis || {};

      // Default values
      const insights = {
        patientReached: false,
        voicemailLeft: false,
        sentiment: "neutral" as "positive" | "negative" | "neutral",
        followUpNeeded: false,
      };

      // Check if patient was reached
      if (
        analysis.patient_reached === true ||
        analysis.patientReached === true ||
        analysis.patient_reached === "true" ||
        analysis.patientReached === "true"
      ) {
        insights.patientReached = true;
      }

      // Check if voicemail was left
      if (
        analysis.voicemail_left === true ||
        analysis.leftVoicemail === true ||
        analysis.left_voicemail === true ||
        analysis.voicemail === true
      ) {
        insights.voicemailLeft = true;
      }

      // Extract sentiment
      if (analysis.sentiment) {
        const sentiment = String(analysis.sentiment).toLowerCase();
        if (sentiment.includes("positive")) {
          insights.sentiment = "positive";
        } else if (sentiment.includes("negative")) {
          insights.sentiment = "negative";
        }
      }

      // Check if follow-up is needed
      if (
        analysis.follow_up_needed === true ||
        analysis.followUpNeeded === true ||
        analysis.callback_requested === true ||
        analysis.callbackRequested === true
      ) {
        insights.followUpNeeded = true;
      }

      return insights;
    },
  };
}

// Create and export the service
export const analyticsService = createAnalyticsService();
