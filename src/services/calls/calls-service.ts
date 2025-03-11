// src/services/calls/call-service.ts
import {
  ServiceResult,
  createError,
  createSuccess,
} from "@/lib/service-result";
import { db } from "@/server/db";
import {
  calls,
  campaignTemplates,
  campaigns,
  patients,
  rows,
  runs,
} from "@/server/db/schema";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

// Import unified types
import {
  CallWithRelations,
  CallsResponse,
  GetCallsOptions,
} from "@/services/calls/types";

/**
 * Service for managing call operations
 */
export function createCallService(dbInstance = db) {
  return {
    /**
     * Get all calls with filtering options
     */
    async getAll(
      options: GetCallsOptions,
    ): Promise<ServiceResult<CallsResponse>> {
      try {
        const {
          limit = 50,
          offset = 0,
          patientId,
          runId,
          status,
          direction,
          orgId,
          search,
          startDate,
          endDate,
          campaignId,
        } = options;

        // Build base query conditions
        let conditions = eq(calls.orgId, orgId);

        // Add additional filters if provided
        if (patientId) {
          conditions = and(conditions, eq(calls.patientId, patientId));
        }

        if (runId) {
          conditions = and(conditions, eq(calls.runId, runId));
        }

        if (status) {
          conditions = and(conditions, eq(calls.status, status as any));
        }

        if (direction) {
          conditions = and(conditions, eq(calls.direction, direction as any));
        }

        if (campaignId) {
          conditions = and(conditions, eq(calls.campaignId, campaignId));
        }

        // Add date range filters
        if (startDate) {
          // At this point, startDate should always be a string
          if (typeof startDate === "string") {
            conditions = and(
              conditions,
              sql`${calls.createdAt} >= ${startDate}`,
            );
          }
        }

        if (endDate) {
          // At this point, endDate should always be a string
          if (typeof endDate === "string") {
            conditions = and(conditions, sql`${calls.createdAt} <= ${endDate}`);
          }
        }

        // Add search filter if provided
        if (search) {
          const searchTerm = `%${search}%`;
          conditions = and(
            conditions,
            or(
              // Search in related patient name
              sql`EXISTS (
                SELECT 1 FROM ${patients} 
                WHERE ${patients.id} = ${calls.patientId} 
                AND (
                  ${ilike(patients.firstName, searchTerm)} OR 
                  ${ilike(patients.lastName, searchTerm)}
                )
              )`,
              // Search in phone numbers
              ilike(calls.toNumber, searchTerm),
              ilike(calls.fromNumber, searchTerm),
            ),
          );
        }

        // Query for calls
        const allCalls = await dbInstance
          .select()
          .from(calls)
          .where(conditions)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(calls.createdAt));

        // Get total count
        const [{ value: totalCount }] = await dbInstance
          .select({ value: count() })
          .from(calls)
          .where(conditions);

        // Load relationships efficiently
        const callsWithRelations = await this.loadRelations(allCalls);

        return createSuccess({
          calls: callsWithRelations,
          totalCount: Number(totalCount),
          hasMore: offset + limit < Number(totalCount),
        });
      } catch (error) {
        console.error("Error fetching calls:", error);
        return createError("INTERNAL_ERROR", "Failed to fetch calls", error);
      }
    },

    /**
     * Get a call by ID
     */
    async getById(
      id: string,
      orgId: string,
    ): Promise<ServiceResult<CallWithRelations>> {
      try {
        // Get call with organization check
        const [call] = await dbInstance
          .select()
          .from(calls)
          .where(and(eq(calls.id, id), eq(calls.orgId, orgId)));

        if (!call) {
          return createError("NOT_FOUND", "Call not found");
        }

        // Get all related data in parallel
        const [patient, campaignData, run, row] = await Promise.all([
          call.patientId
            ? dbInstance.query.patients.findFirst({
                where: eq(patients.id, call.patientId),
              })
            : null,

          call.campaignId
            ? dbInstance
                .select({
                  campaign: campaigns,
                  template: campaignTemplates,
                })
                .from(campaigns)
                .leftJoin(
                  campaignTemplates,
                  eq(campaigns.templateId, campaignTemplates.id),
                )
                .where(eq(campaigns.id, call.campaignId))
                .then((results) => (results.length > 0 ? results[0] : null))
            : null,

          call.runId
            ? dbInstance.query.runs.findFirst({
                where: eq(runs.id, call.runId),
              })
            : null,

          call.rowId
            ? dbInstance.query.rows.findFirst({
                where: eq(rows.id, call.rowId),
              })
            : null,
        ]);

        // Format dates to ISO strings
        const formattedCall = this.formatDates(call);

        // Properly structure campaign data
        const campaign = campaignData
          ? {
              ...campaignData.campaign,
              template: campaignData.template,
              config: campaignData.template
                ? {
                    analysis: campaignData.template.analysisConfig,
                    variables: campaignData.template.variablesConfig,
                    basePrompt: campaignData.template.basePrompt,
                    voicemailMessage: campaignData.template.voicemailMessage,
                  }
                : undefined,
            }
          : null;

        return createSuccess({
          ...formattedCall,
          patient,
          campaign,
          run,
          row,
        });
      } catch (error) {
        console.error("Error fetching call:", error);
        return createError("INTERNAL_ERROR", "Failed to fetch call", error);
      }
    },

    /**
     * Get patient calls with pagination
     */
    async getPatientCalls(
      patientId: string,
      orgId: string,
      limit: number,
    ): Promise<ServiceResult<CallWithRelations[]>> {
      try {
        // Handle case where patientId might be a comma-separated list
        const sanitizedPatientId = patientId.includes(",")
          ? patientId.split(",")[0]
          : patientId;

        const recentCalls = await dbInstance
          .select()
          .from(calls)
          .where(
            and(
              eq(calls.patientId, sanitizedPatientId),
              eq(calls.orgId, orgId),
            ),
          )
          .limit(limit)
          .orderBy(desc(calls.createdAt));

        // Load relations for these calls
        const callsWithRelations = await this.loadRelations(recentCalls);

        return createSuccess(callsWithRelations);
      } catch (error) {
        console.error("Error getting patient calls:", error);
        return createError(
          "INTERNAL_ERROR",
          "Failed to get patient calls",
          error,
        );
      }
    },

    /**
     * Generate call insights from transcript and analysis
     */
    getCallInsights(payload: {
      transcript?: string;
      analysis?: Record<string, any>;
    }): {
      sentiment: "positive" | "negative" | "neutral";
      followUpNeeded: boolean;
      followUpReason?: string;
      patientReached: boolean;
      voicemailLeft: boolean;
    } {
      try {
        const { transcript, analysis } = payload;
        const processedAnalysis = analysis || {};

        // Determine sentiment - check multiple possible field names
        let sentiment: "positive" | "negative" | "neutral" = "neutral";
        const possibleSentimentFields = [
          "sentiment",
          "user_sentiment",
          "patient_sentiment",
          "call_sentiment",
        ];

        for (const field of possibleSentimentFields) {
          if (field in processedAnalysis) {
            const value = processedAnalysis[field];
            if (typeof value === "string") {
              if (value.toLowerCase().includes("positive")) {
                sentiment = "positive";
                break;
              } else if (value.toLowerCase().includes("negative")) {
                sentiment = "negative";
                break;
              }
            }
          }
        }

        // Check if patient was reached
        const patientReachedValue =
          processedAnalysis.patient_reached !== undefined
            ? processedAnalysis.patient_reached
            : processedAnalysis.patientReached;

        const patientReached =
          patientReachedValue === true ||
          patientReachedValue === "true" ||
          patientReachedValue === "yes";

        // Check if voicemail was left
        const voicemailLeft =
          processedAnalysis.voicemail_left === true ||
          processedAnalysis.voicemailLeft === true ||
          processedAnalysis.left_voicemail === true ||
          processedAnalysis.leftVoicemail === true ||
          processedAnalysis.voicemail === true ||
          processedAnalysis.in_voicemail === true ||
          processedAnalysis.voicemail_detected === true;

        // Determine follow-up needs
        const scheduleFollowUp =
          processedAnalysis.callback_requested === true ||
          processedAnalysis.callbackRequested === true ||
          processedAnalysis.callback_requested === "true" ||
          processedAnalysis.callbackRequested === "true";

        const patientHadQuestions =
          processedAnalysis.patient_questions === true ||
          processedAnalysis.patientQuestion === true ||
          processedAnalysis.has_questions === true ||
          processedAnalysis.hasQuestions === true ||
          processedAnalysis.patient_question === "true" ||
          processedAnalysis.patientQuestion === "true";

        let followUpNeeded =
          scheduleFollowUp ||
          patientHadQuestions ||
          !patientReached ||
          sentiment === "negative";

        // Determine reason for follow-up
        let followUpReason;
        if (followUpNeeded) {
          if (scheduleFollowUp) {
            followUpReason = "Patient requested follow-up";
          } else if (patientHadQuestions) {
            followUpReason = "Patient had unanswered questions";
          } else if (!patientReached) {
            followUpReason = "Unable to reach patient";
          } else if (sentiment === "negative") {
            followUpReason = "Negative sentiment detected";
          }
        }

        // Use transcript to enhance insights if available
        if (transcript && typeof transcript === "string") {
          // Check for callback requests in transcript
          if (
            !followUpNeeded &&
            (transcript.toLowerCase().includes("call me back") ||
              transcript.toLowerCase().includes("callback") ||
              transcript.toLowerCase().includes("call me tomorrow"))
          ) {
            followUpNeeded = true;
            followUpReason = "Callback request detected in transcript";
          }

          // Detect sentiment from transcript if not already determined
          if (sentiment === "neutral") {
            const positiveWords = [
              "great",
              "good",
              "excellent",
              "happy",
              "pleased",
              "thank you",
              "appreciate",
            ];
            const negativeWords = [
              "bad",
              "unhappy",
              "disappointed",
              "frustrated",
              "upset",
              "angry",
              "not right",
            ];

            let positiveCount = 0;
            let negativeCount = 0;

            const transcriptLower = transcript.toLowerCase();

            positiveWords.forEach((word) => {
              if (transcriptLower.includes(word)) positiveCount++;
            });

            negativeWords.forEach((word) => {
              if (transcriptLower.includes(word)) negativeCount++;
            });

            if (positiveCount > negativeCount + 1) {
              sentiment = "positive";
            } else if (negativeCount > positiveCount) {
              sentiment = "negative";
            }
          }
        }

        return {
          sentiment,
          followUpNeeded,
          followUpReason,
          patientReached,
          voicemailLeft,
        };
      } catch (error) {
        console.error("Error extracting call insights:", error);

        // Return default values on error
        return {
          sentiment: "neutral",
          followUpNeeded: false,
          patientReached: false,
          voicemailLeft: false,
        };
      }
    },

    /**
     * Helper method to efficiently load related entities for calls
     */
    async loadRelations(
      callsList: Array<typeof calls.$inferSelect>,
    ): Promise<CallWithRelations[]> {
      if (!callsList.length) return [];

      // Extract IDs for batch loading
      const patientIds = callsList
        .map((c) => c.patientId)
        .filter(Boolean) as string[];

      const campaignIds = callsList
        .map((c) => c.campaignId)
        .filter(Boolean) as string[];

      const runIds = callsList.map((c) => c.runId).filter(Boolean) as string[];

      // Batch load all relations in parallel
      const [patientsData, campaignsData, runsData] = await Promise.all([
        patientIds.length
          ? dbInstance
              .select()
              .from(patients)
              .where(
                patientIds.length === 1
                  ? eq(patients.id, patientIds[0])
                  : inArray(patients.id, patientIds),
              )
          : [],

        campaignIds.length
          ? dbInstance
              .select({
                campaign: campaigns,
                template: campaignTemplates,
              })
              .from(campaigns)
              .leftJoin(
                campaignTemplates,
                eq(campaigns.templateId, campaignTemplates.id),
              )
              .where(
                campaignIds.length === 1
                  ? eq(campaigns.id, campaignIds[0])
                  : inArray(campaigns.id, campaignIds),
              )
          : [],

        runIds.length
          ? dbInstance
              .select()
              .from(runs)
              .where(
                runIds.length === 1
                  ? eq(runs.id, runIds[0])
                  : inArray(runs.id, runIds),
              )
          : [],
      ]);

      // Create maps for quick lookups
      const patientMap = new Map(
        patientsData.map((p) => [p.id, p]) as [
          string,
          typeof patients.$inferSelect,
        ][],
      );

      // Fix campaign map to properly handle template data
      const campaignMap = new Map(
        campaignsData.map(({ campaign, template }) => {
          // Ensure we have a properly structured campaign object with config
          return [
            campaign.id,
            {
              ...campaign,
              // Store the template directly instead of as an array
              template: template,
              // Properly structure the config object
              config: template
                ? {
                    analysis: template.analysisConfig,
                    variables: template.variablesConfig,
                    basePrompt: template.basePrompt,
                    voicemailMessage: template.voicemailMessage,
                  }
                : undefined,
            },
          ] as const;
        }),
      );

      const runMap = new Map(
        runsData.map((r) => [r.id, r]) as [string, typeof runs.$inferSelect][],
      );

      // Process all calls at once and format dates
      return callsList.map((call) => {
        // Format dates to ISO strings
        const formattedCall = this.formatDates(call);

        // Add related entities
        return {
          ...formattedCall,
          patient: call.patientId
            ? patientMap.get(call.patientId) || null
            : null,
          campaign: call.campaignId
            ? campaignMap.get(call.campaignId) || null
            : null,
          run: call.runId ? runMap.get(call.runId) || null : null,
        };
      });
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
  };
}

// Create and export the service
export const callService = createCallService();
