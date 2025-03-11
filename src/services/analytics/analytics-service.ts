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
  campaignTemplates,
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
                               (${calls.analysis}::jsonb->>'patient_reached')::text = 'true' THEN 1 END)`,
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
                              (${calls.analysis}::jsonb->>'voicemail_left')::text = 'true' OR 
                              (${calls.analysis}::jsonb->>'left_voicemail')::text = 'true' THEN 1 ELSE 0 END)`,
            connected: sql`SUM(CASE WHEN (${calls.analysis}::jsonb->>'patient_reached')::text = 'true' OR 
                              (${calls.analysis}::jsonb->>'patientReached')::text = 'true' THEN 1 ELSE 0 END)`,
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
            successCount: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}::jsonb->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
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
            connected: sql`SUM(CASE WHEN (${calls.analysis}::jsonb->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
            voicemail: sql`SUM(CASE WHEN (${calls.analysis}::jsonb->>'left_voicemail')::text = 'true' OR
                             (${calls.analysis}::jsonb->>'voicemail')::text = 'true' THEN 1 ELSE 0 END)`,
            missed: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND 
                             NOT((${calls.analysis}::jsonb->>'patient_reached')::text = 'true') AND
                             NOT((${calls.analysis}::jsonb->>'left_voicemail')::text = 'true') THEN 1 ELSE 0 END)`,
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
            reached: sql`SUM(CASE WHEN (${calls.analysis}::jsonb->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
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
            reached: sql`SUM(CASE WHEN (${calls.analysis}::jsonb->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
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
            connected: sql`SUM(CASE WHEN (${calls.analysis}::jsonb->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
            voicemail: sql`SUM(CASE WHEN (${calls.analysis}::jsonb->>'left_voicemail')::text = 'true' OR
                                      (${calls.analysis}::jsonb->>'voicemail')::text = 'true' THEN 1 ELSE 0 END)`,
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
     * Get campaign analytics by campaign ID
     */
    async getCampaignAnalytics(
      campaignId: string,
    ): Promise<ServiceResult<CampaignAnalytics>> {
      try {
        console.log(`Starting analytics for campaign ${campaignId}`);

        // Get campaign details - use prepared statement to ensure UUID conversion
        const campaign = await dbInstance
          .select()
          .from(campaigns)
          .where(sql`${campaigns.id}::uuid = ${campaignId}::uuid`)
          .limit(1)
          .then((rows) => rows[0]);

        if (!campaign) {
          return createError("NOT_FOUND", "Campaign not found");
        }

        console.log(`Campaign found: ${campaign.id}`);

        // Get template separately using prepared statement
        let template = null;
        try {
          template = await dbInstance
            .select()
            .from(campaignTemplates)
            .where(
              sql`${campaignTemplates.id}::uuid = ${campaign.templateId}::uuid`,
            )
            .limit(1)
            .then((rows) => rows[0]);

          console.log(`Template found: ${template?.id || "none"}`);
        } catch (templateError) {
          console.error("Error fetching template:", templateError);
          // Continue without template - we'll handle this gracefully
        }

        // Get call metrics with explicit casting
        const [callMetrics] = await dbInstance
          .select({
            total: count(),
            completed: sql`COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
            failed: sql`COUNT(CASE WHEN ${calls.status} = 'failed' THEN 1 END)`,
            voicemail: sql`COUNT(CASE WHEN ${calls.status} = 'voicemail' THEN 1 END)`,
            inProgress: sql`COUNT(CASE WHEN ${calls.status} = 'in-progress' THEN 1 END)`,
            pending: sql`COUNT(CASE WHEN ${calls.status} = 'pending' THEN 1 END)`,
            success: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}::jsonb->>'patient_reached')::text = 'true' THEN 1 END)`,
            inbound: sql`COUNT(CASE WHEN ${calls.direction} = 'inbound' THEN 1 END)`,
            outbound: sql`COUNT(CASE WHEN ${calls.direction} = 'outbound' THEN 1 END)`,
          })
          .from(calls)
          .where(sql`${calls.campaignId}::uuid = ${campaignId}::uuid`);

        // Get conversion metrics from campaign's analysis config
        const conversionMetrics: any[] = [];

        // Safely access nested properties with optional chaining and validate structure
        // Shortcut: if no template or missing config, just return empty metrics
        if (!template || !template.analysisConfig?.campaign?.fields) {
          console.log("No template or missing analysisConfig.campaign.fields");

          // Get run metrics even if template is missing, with explicit casting
          const runMetrics = await dbInstance
            .select({
              id: runs.id,
              name: runs.name,
              totalCalls: sql`COUNT(${calls.id})`,
              completedCalls: sql`SUM(CASE WHEN ${calls.status} = 'completed' THEN 1 ELSE 0 END)`,
              successCalls: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}::jsonb->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
            })
            .from(runs)
            .leftJoin(calls, eq(calls.runId, runs.id))
            .where(sql`${runs.campaignId}::uuid = ${campaignId}::uuid`)
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
            conversionMetrics: [],
            runMetrics: runMetrics.map((run) => ({
              id: run.id,
              name: run.name || "Unnamed Run",
              totalCalls: Number(run.totalCalls || 0),
              completedCalls: Number(run.completedCalls || 0),
              conversionRate:
                Number(run.completedCalls) > 0
                  ? (Number(run.successCalls) / Number(run.completedCalls)) *
                    100
                  : 0,
            })),
            lastUpdated: new Date().toISOString(),
          });
        }

        const analysisFields = template.analysisConfig?.campaign?.fields || [];
        console.log(`Analysis fields count: ${analysisFields.length}`);

        for (const field of analysisFields) {
          if (!field || !field.key) {
            console.log("Skipping analysis field due to missing key");
            continue;
          }

          if (field.type === "boolean") {
            // For boolean fields, get true/false counts with direct SQL
            const fieldKey = field.key;
            try {
              const [metrics] = await dbInstance
                .select({
                  total: sql`COUNT(${calls.id})`,
                  trueCount: sql`COUNT(CASE WHEN COALESCE(${calls.analysis}::jsonb->>${sql.raw("$1")}, 'false')::text = 'true' THEN 1 END)`,
                  falseCount: sql`COUNT(CASE WHEN COALESCE(${calls.analysis}::jsonb->>${sql.raw("$1")}, 'false')::text = 'false' THEN 1 END)`,
                })
                .from(calls)
                .where(
                  and(
                    sql`${calls.campaignId}::uuid = ${campaignId}::uuid`,
                    eq(calls.status, "completed"),
                  ),
                )
                .prepare("get_boolean_metrics")
                .execute({ 1: fieldKey });

              conversionMetrics.push({
                field: field.key,
                label: field.label || field.key,
                type: field.type,
                values: {
                  true: Number(metrics?.trueCount || 0),
                  false: Number(metrics?.falseCount || 0),
                },
                total: Number(metrics?.total || 0),
                rate:
                  Number(metrics?.total) > 0
                    ? (Number(metrics?.trueCount) / Number(metrics?.total)) *
                      100
                    : 0,
              });
            } catch (error) {
              console.error(
                `Error processing boolean field ${fieldKey}:`,
                error,
              );
              // Continue with other fields
            }
          } else if (field.type === "enum" && Array.isArray(field.options)) {
            // Check if options array has valid structure
            let validOptions = true;
            for (const option of field.options) {
              if (!option || typeof option.value !== "string") {
                validOptions = false;
                console.log(`Invalid option in field ${field.key}`);
                break;
              }
            }

            if (!validOptions) {
              console.log(
                `Skipping enum field ${field.key} due to invalid options`,
              );
              continue;
            }

            // For enum fields, handle all options
            const optionCounts: Record<string, number> = {};
            let total = 0;

            // Initialize counts for all options
            for (const option of field.options) {
              // We've already validated option.value above
              optionCounts[option.value] = 0;
            }

            // Get counts from database with direct SQL using prepared statements
            const fieldKey = field.key;
            try {
              const optionMetrics = await dbInstance
                .select({
                  value: sql`${calls.analysis}::jsonb->>${sql.raw("$1")}`,
                  count: sql`COUNT(*)`,
                })
                .from(calls)
                .where(
                  and(
                    sql`${calls.campaignId}::uuid = ${campaignId}::uuid`,
                    eq(calls.status, "completed"),
                    sql`${calls.analysis}::jsonb->>${sql.raw("$1")} IS NOT NULL`,
                  ),
                )
                .groupBy(sql`${calls.analysis}::jsonb->>${sql.raw("$1")}`)
                .prepare("get_enum_metrics")
                .execute({ 1: fieldKey });

              // Update counts with actual values
              for (const metric of optionMetrics) {
                const value = metric.value as string;
                const count = Number(metric.count || 0);
                if (value && optionCounts[value] !== undefined) {
                  optionCounts[value] = count;
                }
                total += count;
              }

              // Find the highest count to calculate rate - safely handle empty arrays
              const values = Object.values(optionCounts);
              const highestCount = values.length > 0 ? Math.max(...values) : 0;

              conversionMetrics.push({
                field: field.key,
                label: field.label || field.key,
                type: field.type,
                values: optionCounts,
                total,
                rate: total > 0 ? (highestCount / total) * 100 : 0,
              });
            } catch (error) {
              console.error(`Error processing enum field ${fieldKey}:`, error);
              // Continue with other fields
            }
          }
        }

        // Get run metrics with explicit casting
        const runMetrics = await dbInstance
          .select({
            id: runs.id,
            name: runs.name,
            totalCalls: sql`COUNT(${calls.id})`,
            completedCalls: sql`SUM(CASE WHEN ${calls.status} = 'completed' THEN 1 ELSE 0 END)`,
            successCalls: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}::jsonb->>'patient_reached')::text = 'true' THEN 1 ELSE 0 END)`,
          })
          .from(runs)
          .leftJoin(calls, eq(calls.runId, runs.id))
          .where(sql`${runs.campaignId}::uuid = ${campaignId}::uuid`)
          .groupBy(runs.id, runs.name)
          .orderBy(desc(runs.createdAt))
          .limit(10);

        console.log("Analytics processing completed successfully");

        // Ensure we always return a valid ServiceResult by wrapping in try/catch
        try {
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
              name: run.name || "Unnamed Run",
              totalCalls: Number(run.totalCalls || 0),
              completedCalls: Number(run.completedCalls || 0),
              conversionRate:
                Number(run.completedCalls) > 0
                  ? (Number(run.successCalls) / Number(run.completedCalls)) *
                    100
                  : 0,
            })),
            lastUpdated: new Date().toISOString(),
          });
        } catch (returnError) {
          console.error("Error creating success result:", returnError);
          return createError(
            "INTERNAL_ERROR",
            "Failed to process analytics result",
            returnError,
          );
        }
      } catch (error) {
        console.error("Error getting campaign analytics:", error);
        // Include more details in the error for debugging
        if (error instanceof Error) {
          console.error(`Error stack: ${error.stack}`);
        }
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
        console.log("Getting run analytics for runId:", runId);

        // Get run details with related campaign using direct select instead of query
        const [run] = await dbInstance
          .select({
            id: runs.id,
            name: runs.name,
            status: runs.status,
            metadata: runs.metadata,
            createdAt: runs.createdAt,
            campaignId: runs.campaignId,
          })
          .from(runs)
          .where(eq(runs.id, runId));

        if (!run) {
          console.error("Run not found for id:", runId);
          return createError("NOT_FOUND", "Run not found");
        }

        console.log("Found run:", run.id, run.name);

        // Get campaign name using direct select
        const [campaign] = await dbInstance
          .select({
            name: campaigns.name,
          })
          .from(campaigns)
          .where(eq(campaigns.id, run.campaignId));

        console.log("Found campaign:", campaign?.name);

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

        // Call metrics - get actual counts from call records, not metadata
        const [callMetrics] = await dbInstance
          .select({
            total: count(),
            patientsReached: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}::jsonb->>'patient_reached')::text = 'true' THEN 1 END)`,
            voicemailsLeft: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}::jsonb->>'left_voicemail')::text = 'true' THEN 1 END)`,
            noAnswer: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}::jsonb->>'patient_reached')::text = 'false' AND (${calls.analysis}::jsonb->>'left_voicemail')::text = 'false' THEN 1 END)`,
            averageCallDuration: avg(
              sql`CASE WHEN ${calls.analysis}::jsonb->>'duration' IS NOT NULL THEN CAST(${calls.analysis}::jsonb->>'duration' AS INTEGER) ELSE NULL END`,
            ),
            conversionCount: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}::jsonb->>'conversion')::text = 'true' THEN 1 END)`,
            completedCount: sql`COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
            failedCount: sql`COUNT(CASE WHEN ${calls.status} = 'failed' THEN 1 END)`,
            voicemailCount: sql`COUNT(CASE WHEN ${calls.status} = 'voicemail' THEN 1 END)`,
            inProgress: sql`COUNT(CASE WHEN ${calls.status} = 'in-progress' THEN 1 END)`,
            pendingCount: sql`COUNT(CASE WHEN ${calls.status} = 'pending' THEN 1 END)`,
            connectedCount: sql`COUNT(CASE WHEN ${calls.status} = 'completed' AND (${calls.analysis}::jsonb->>'patient_reached')::text = 'true' THEN 1 END)`,
            inboundReturns: sql`COUNT(CASE WHEN ${calls.direction} = 'inbound' THEN 1 END)`,
          })
          .from(calls)
          .where(eq(calls.runId, runId));

        // Call timeline
        const callTimeline = await dbInstance
          .select({
            time: calls.createdAt,
            status: calls.status,
            reached: sql`(${calls.analysis}::jsonb->>'patient_reached')::text = 'true'`,
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
        let analysisFields = [];
        try {
          analysisFields = await dbInstance
            .select({
              field: sql`key`,
              value: sql`value`,
              count: sql`COUNT(*)`,
            })
            .from(calls)
            .leftJoin(sql`jsonb_each_text(${calls.analysis}::jsonb)`, sql`true`)
            .where(
              and(
                eq(calls.runId, runId),
                eq(calls.status, "completed"),
                sql`key != 'patient_reached' AND key != 'left_voicemail'`,
              ),
            )
            .groupBy(sql`key`, sql`value`)
            .orderBy(sql`key`, sql`COUNT(*) DESC`);
        } catch (error) {
          console.error("Error fetching analysis fields:", error);
          // Continue with empty analysis fields
        }

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

        // Update run metadata with latest stats to keep it in sync
        const updatedMetadata = {
          ...run.metadata,
          calls: {
            ...(run.metadata?.calls || {}),
            total: Number(callMetrics?.total || 0),
            completed: Number(callMetrics?.completedCount || 0),
            failed: Number(callMetrics?.failedCount || 0),
            voicemail: Number(callMetrics?.voicemailCount || 0),
            inProgress: Number(callMetrics?.inProgress || 0),
            pending: Number(callMetrics?.pendingCount || 0),
            connected: Number(callMetrics?.connectedCount || 0),
            inbound_returns: Number(callMetrics?.inboundReturns || 0),
          },
        };

        // Update the run record with the latest stats - using proper schema reference
        try {
          // Use raw SQL with proper table name
          await dbInstance.execute(
            sql`UPDATE "rivvi_run" SET metadata = ${JSON.stringify(updatedMetadata)}, 
                updated_at = NOW() WHERE id = ${runId}`,
          );
          console.log("Updated run metadata successfully");
        } catch (updateError) {
          console.error("Error updating run metadata:", updateError);
          // Continue even if metadata update fails
        }

        // Prepare the result in the correct RunAnalytics format
        return createSuccess({
          overview: {
            name: run.name,
            campaignName: campaign?.name || "Unknown Campaign",
            status: run.status,
            totalRows: Number(rowCounts?.totalRows || 0),
            completedCalls: Number(callMetrics?.completedCount || 0),
            pendingCalls:
              Number(callMetrics?.pendingCount || 0) +
              Number(callMetrics?.inProgress || 0),
            failedCalls: Number(callMetrics?.failedCount || 0),
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
            conversionRate:
              Number(callMetrics?.completedCount) > 0
                ? (Number(callMetrics?.conversionCount) /
                    Number(callMetrics?.completedCount)) *
                  100
                : 0,
            inboundReturns: Number(callMetrics?.inboundReturns || 0),
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
