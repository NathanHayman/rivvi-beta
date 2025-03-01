// src/lib/webhook-handler.ts
import { db } from "@/server/db";
import {
  calls,
  campaigns,
  organizations,
  rows,
  runs,
} from "@/server/db/schema";
import { RetellPostCallObjectRaw } from "@/types/retell";
import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { PatientService } from "./patient/patient-service";
import { pusherServer } from "./pusher-server";

/**
 * Handle inbound webhook from Retell
 * This processes incoming calls, identifies patients, and provides context
 */
export async function handleInboundWebhook(
  orgId: string,
  payload: {
    from_number: string;
    to_number: string;
    call_id?: string;
    agent_id?: string;
    llm_id?: string;
    [key: string]: any;
  },
) {
  try {
    console.log(
      `Handling inbound webhook for org ${orgId}:`,
      JSON.stringify(payload),
    );

    // Get organization details
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!organization) {
      throw new Error(`Organization ${orgId} not found`);
    }

    // Find patient by phone number within this organization
    const patientService = new PatientService(db);
    const cleanPhone = payload.from_number.replace(/\D/g, "");

    const patient = await patientService.findPatientByPhone(
      payload.from_number,
      orgId,
    );

    // Create a minimal patient record if not found
    let patientId: string | null = patient?.id || null;
    if (!patient) {
      try {
        // Create a basic patient record with today's date as a placeholder DOB
        const today = new Date().toISOString().split("T")[0]; // Format as YYYY-MM-DD

        const patientResult = await patientService.findOrCreatePatient({
          firstName: "Unknown",
          lastName: "Caller",
          dob: today || "",
          phone: cleanPhone,
          orgId, // Pass the orgId directly without modification
        });

        patientId = patientResult?.id || null;
      } catch (error) {
        console.error("Error in findOrCreatePatient:", error);
        // Continue with a null patientId if patient creation fails
        patientId = null;
      }
    }

    // Get recent outbound calls to this patient
    let recentCalls: any[] = [];
    if (patientId) {
      recentCalls = await db
        .select({
          id: calls.id,
          createdAt: calls.createdAt,
          campaignName: campaigns.name,
          status: calls.status,
          variables: calls.metadata,
          analysis: calls.analysis,
        })
        .from(calls)
        .leftJoin(runs, eq(calls.runId, runs.id))
        .leftJoin(campaigns, eq(runs.campaignId, campaigns.id))
        .where(
          and(
            eq(calls.patientId, patientId),
            eq(calls.orgId, orgId),
            eq(calls.direction, "outbound"),
          ),
        )
        .orderBy(desc(calls.createdAt))
        .limit(3);
    }

    // Get any active campaign information
    const [inboundCampaign] = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.orgId, orgId),
          eq(campaigns.type, "inbound"),
          eq(campaigns.isActive, true),
        ),
      );

    // Create inbound call record
    try {
      // Ensure we have valid values for required fields
      if (!payload.agent_id) {
        // Try to use llm_id as a fallback if available
        if (payload.llm_id) {
          payload.agent_id = payload.llm_id;
          console.log(`Using llm_id as agent_id fallback: ${payload.llm_id}`);
        } else {
          console.warn(
            `No agent_id provided in webhook for org ${orgId}. Using default value.`,
          );
          payload.agent_id = "default-inbound-agent";
        }
      }

      const agent_id = payload.agent_id;

      if (!payload.call_id) {
        payload.call_id = createId();
        console.log(`Generated new call_id: ${payload.call_id}`);
      }

      const call_id = payload.call_id;

      // Insert call record
      let insertedCall: { id: string } | null = null;
      try {
        const result = await db
          .insert(calls)
          .values({
            orgId,
            patientId,
            fromNumber: payload.from_number,
            toNumber: payload.to_number,
            retellCallId: payload.call_id,
            agentId: agent_id,
            direction: "inbound",
            status: "in-progress",
          })
          .returning();

        insertedCall = result[0] ? { id: result[0].id } : null;
        console.log(`Successfully inserted call record: ${insertedCall?.id}`);
      } catch (error) {
        console.error("Error inserting call record:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to create inbound call record: ${errorMessage}`,
        );
      }

      // Create context for agent
      const context: Record<string, any> = {
        organization_name: organization.name,
        inbound_call: true,
      };

      if (patient) {
        context.patient_first_name = patient.firstName;
        context.patient_last_name = patient.lastName;
        context.patient_phone = patient.primaryPhone;
        context.patient_exists = true;
      } else {
        context.patient_exists = false;
        context.caller_phone = payload.from_number;
      }

      // Add recent call information if available
      if (recentCalls.length > 0) {
        context.recent_calls_count = recentCalls.length;
        context.recent_call_summary = recentCalls
          .map(
            (call, index) =>
              `Call ${index + 1}: ${call.createdAt.toLocaleString()} - Campaign: ${call.campaignName || "Unknown"} - ${call.patientReached === "true" ? "Patient was reached" : "Patient was not reached"}`,
          )
          .join("; ");

        // Add information about most recent call
        const lastCall = recentCalls[0];
        if (lastCall) {
          context.last_call_date = lastCall.createdAt.toLocaleString();
          context.last_call_campaign = lastCall.campaignName;
          context.last_call_reached_patient =
            lastCall.patientReached === "true";

          // Add any campaign-specific variables from the last call
          const campaignVars = lastCall.variables?.variables || {};
          Object.entries(campaignVars).forEach(([key, value]) => {
            // Only add non-standard variables (not patient info)
            if (
              ![
                "firstName",
                "lastName",
                "dob",
                "primaryPhone",
                "phone",
              ].includes(key)
            ) {
              context[`campaign_${key}`] = value;
            }
          });

          // Add post-call data from last call if available
          if (lastCall.postCallData) {
            Object.entries(lastCall.postCallData).forEach(([key, value]) => {
              if (key !== "patient_reached" && key !== "left_voicemail") {
                context[`last_call_${key}`] = value;
              }
            });
          }
        }
      } else {
        context.recent_calls_count = 0;
        context.is_first_call = true;
      }

      // Send real-time update
      await pusherServer.trigger(`org-${orgId}`, "inbound-call", {
        callId: insertedCall?.id ?? call_id,
        patientId,
        fromNumber: payload.from_number,
        toNumber: payload.to_number,
        retellCallId: call_id,
        time: new Date().toISOString(),
      });

      return {
        status: "success",
        call_id: insertedCall?.id ?? call_id,
        variables: context,
      };
    } catch (error) {
      console.error("Error inserting call record:", error);
      throw error; // Rethrow to be caught by the outer try/catch
    }
  } catch (error) {
    console.error(`Error handling inbound webhook for org ${orgId}:`, error);

    // Return a minimal context to avoid disrupting the call
    return {
      status: "error",
      variables: {
        organization_name: "Our organization",
        error_occurred: true,
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handler for Retell post-call webhook
 * Processes call results and updates database records
 * Expects webhook payload from call_analyzed event
 */
export async function handlePostCallWebhook(
  orgId: string,
  campaignId: string,
  payload: RetellPostCallObjectRaw,
) {
  try {
    console.log(
      `Handling post-call webhook for org ${orgId}, campaign ${campaignId}:`,
      JSON.stringify(payload),
    );

    // Find the call record
    const [call] = await db
      .select()
      .from(calls)
      .where(
        and(eq(calls.retellCallId, payload.call_id), eq(calls.orgId, orgId)),
      );

    if (!call) {
      throw new Error(
        `Call with Retell ID ${payload.call_id} not found for org ${orgId}`,
      );
    }

    // Fetch campaign configuration if campaignId is provided
    let campaignConfig = null;
    if (campaignId) {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.orgId, orgId)));

      if (campaign) {
        campaignConfig = campaign.config;
      }
    }

    // Process analysis data with campaign-specific validation
    let processedAnalysis = payload.call_analysis?.custom_analysis_data || {};
    if (campaignConfig && campaignConfig.analysis) {
      // Apply campaign-specific analysis processing
      try {
        const analysisSchema = campaignConfig.analysis;

        // Process standard fields
        if (analysisSchema.standard?.fields) {
          // Validate standard fields if defined in the campaign config
        }

        // Process campaign-specific fields
        if (analysisSchema.campaign?.fields) {
          // Track campaign-specific KPIs
          const mainKPIs = analysisSchema.campaign.fields
            .filter((field) => field.isMainKPI)
            .map((field) => field.key);

          // Add campaign KPI tracking metadata
          if (mainKPIs.length > 0) {
            // Create separate records for different types to match the expected types
            const campaignKPIsString: Record<string, string> = {};
            const campaignKPIsBoolean: Record<string, boolean> = {};
            const campaignKPIsNumber: Record<string, number> = {};

            // Extract KPI values from analysis data and add to appropriate record
            for (const kpiKey of mainKPIs) {
              if (typeof kpiKey === "string" && kpiKey in processedAnalysis) {
                const value = processedAnalysis[kpiKey];
                if (typeof value === "string") {
                  campaignKPIsString[kpiKey] = value;
                } else if (typeof value === "boolean") {
                  campaignKPIsBoolean[kpiKey] = value;
                } else if (typeof value === "number") {
                  campaignKPIsNumber[kpiKey] = value;
                }
              }
            }

            // Add the appropriate record to processedAnalysis based on which has values
            if (Object.keys(campaignKPIsString).length > 0) {
              processedAnalysis = {
                ...processedAnalysis,
                _campaignKPIsString: campaignKPIsString,
              };
            }
            if (Object.keys(campaignKPIsBoolean).length > 0) {
              processedAnalysis = {
                ...processedAnalysis,
                _campaignKPIsBoolean: campaignKPIsBoolean,
              };
            }
            if (Object.keys(campaignKPIsNumber).length > 0) {
              processedAnalysis = {
                ...processedAnalysis,
                _campaignKPIsNumber: campaignKPIsNumber,
              };
            }
          }
        }
      } catch (err) {
        console.warn(`Error processing campaign-specific analysis data:`, err);
      }
    }

    // Update call record
    await db
      .update(calls)
      .set({
        status:
          payload.call_status === "completed"
            ? "completed"
            : payload.call_status === "failed"
              ? "failed"
              : call.status,
        recordingUrl: payload.recording_url || call.recordingUrl,
        transcript: payload.call_analysis?.transcript || call.transcript,
        analysis: payload.call_analysis?.custom_analysis_data || call.analysis,
        // Store campaign ID if schema allows it
        // campaignId: campaignId || call.campaignId,
        metadata: {
          ...call.metadata,
          analysisData: processedAnalysis || call.metadata?.analysisData,
          campaignId, // Add campaign ID to metadata
          error:
            payload.call_status === "failed"
              ? payload.disconnection_reason || "Call failed"
              : null,
        },
        updatedAt: new Date(),
      })
      .where(eq(calls.id, call.id));

    // If this is an outbound call, update the row status
    if (call.direction === "outbound" && call.rowId) {
      await db
        .update(rows)
        .set({
          status:
            payload.call_status === "completed"
              ? "completed"
              : payload.call_status === "failed"
                ? "failed"
                : "calling",
          error:
            payload.call_status === "failed"
              ? payload.disconnection_reason || "Call failed"
              : null,
          analysis: processedAnalysis || null,
          // Add campaign ID to metadata instead of directly to row if schema doesn't support it
          metadata: {
            ...(typeof call.metadata === "object" ? call.metadata : {}),
            campaignId,
          },
          updatedAt: new Date(),
        })
        .where(eq(rows.id, call.rowId));
    }

    // If the call has a run ID, update run metrics
    if (call.runId) {
      // Get the run
      const [run] = await db.select().from(runs).where(eq(runs.id, call.runId));

      if (run) {
        // Create a deep copy of metadata
        const metadata = JSON.parse(
          JSON.stringify(run.metadata || {}),
        ) as Record<string, any>;

        // Initialize calls stats if not present
        if (!metadata.calls) {
          metadata.calls = {
            total: 0,
            completed: 0,
            failed: 0,
            voicemail: 0,
            reached: 0,
            converted: 0,
          };
        }

        // Update metrics
        if (payload.call_status === "completed") {
          metadata.calls.completed = (metadata.calls.completed || 0) + 1;

          // Check if patient was reached
          const patientReachedValue =
            payload.call_analysis?.custom_analysis_data?.patient_reached;
          if (
            patientReachedValue === true ||
            (typeof patientReachedValue === "string" &&
              patientReachedValue === "true")
          ) {
            metadata.calls.reached = (metadata.calls.reached || 0) + 1;
          }

          // Check if voicemail was left - support both analysis field and direct in_voicemail field
          if (payload.call_analysis?.in_voicemail === true) {
            metadata.calls.voicemail = (metadata.calls.voicemail || 0) + 1;
          }

          // Check for conversion if defined in analysis data
          // This needs to match the campaign config if it has a main KPI of conversion
          let conversionValue = false;

          // First check if there's a main KPI defined in the campaign config
          if (campaignConfig?.analysis?.campaign?.fields) {
            const conversionField =
              campaignConfig.analysis.campaign.fields.find(
                (field) => field.isMainKPI && field.key,
              );

            if (conversionField && conversionField.key) {
              // Use the main KPI field as the conversion metric
              const kpiValue =
                payload.call_analysis?.custom_analysis_data?.[
                  conversionField.key
                ];
              conversionValue =
                kpiValue === true ||
                (typeof kpiValue === "string" && kpiValue === "true");
            }
          }

          // If no main KPI was found or it wasn't truthy, fallback to call_successful
          if (!conversionValue) {
            conversionValue = payload.call_analysis?.call_successful === true;
          }

          if (conversionValue) {
            metadata.calls.converted = (metadata.calls.converted || 0) + 1;
          }
        } else if (payload.call_status === "failed") {
          metadata.calls.failed = (metadata.calls.failed || 0) + 1;
        }

        // Update run metadata
        await db
          .update(runs)
          .set({
            metadata: metadata as any,
            updatedAt: new Date(),
          })
          .where(eq(runs.id, call.runId));

        // Check if run is complete (all rows processed)
        const [{ value: pendingRows }] = (await db
          .select({
            value: sql`COUNT(*)`.mapWith(Number),
          })
          .from(rows)
          .where(
            and(
              eq(rows.runId, call.runId),
              or(eq(rows.status, "pending"), eq(rows.status, "calling")),
            ),
          )) as [{ value: number }];

        if (pendingRows === 0) {
          // Update run status to completed
          await db
            .update(runs)
            .set({
              status: "completed",
              metadata: {
                ...metadata,
                run: {
                  ...metadata.run,
                  endTime: new Date().toISOString(),
                  duration: metadata.run?.startTime
                    ? Math.floor(
                        (Date.now() -
                          new Date(metadata.run.startTime).getTime()) /
                          1000,
                      )
                    : undefined,
                },
              } as any,
              updatedAt: new Date(),
            })
            .where(eq(runs.id, call.runId));

          // Send real-time update for run completion
          await pusherServer.trigger(`org-${orgId}`, "run-updated", {
            runId: call.runId,
            status: "completed",
          });
        }

        // Send real-time update for run metrics
        await pusherServer.trigger(`run-${call.runId}`, "metrics-updated", {
          runId: call.runId,
          metrics: metadata,
        });
      }
    }

    // Send real-time updates
    await pusherServer.trigger(`org-${orgId}`, "call-updated", {
      callId: call.id,
      status: payload.call_status,
      patientId: call.patientId,
      runId: call.runId,
      // Include campaign ID in metadata rather than as a direct property
      metadata: {
        campaignId,
      },
      analysis: processedAnalysis,
    });

    // Add campaign-specific channel updates
    if (campaignId) {
      await pusherServer.trigger(`campaign-${campaignId}`, "call-completed", {
        callId: call.id,
        status: payload.call_status,
        patientId: call.patientId,
        analysis: processedAnalysis,
      });
    }

    if (call.runId) {
      await pusherServer.trigger(`run-${call.runId}`, "call-completed", {
        callId: call.id,
        status: payload.call_status,
        rowId: call.rowId,
        // Include campaign ID in metadata rather than as a direct property
        metadata: {
          campaignId,
        },
        analysis: processedAnalysis,
      });
    }

    return {
      status: "success",
      callId: call.id,
      message: "Call data processed successfully",
    };
  } catch (error) {
    console.error(`Error handling post-call webhook for org ${orgId}:`, error);

    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract insights from a call transcript using pattern matching and NLP
 * This is a simplified version - in production, you might use a more sophisticated NLP service
 */
export function extractCallInsights(payload: {
  transcript?: string;
  analysis?: Record<string, any>;
}): {
  sentiment: "positive" | "negative" | "neutral";
  followUpNeeded: boolean;
  followUpReason?: string;
} {
  try {
    const analysis = payload.analysis || {};
    const sentiment = analysis.user_sentiment || "neutral";

    // Determine if follow-up is needed
    const followUpNeeded =
      analysis.schedule_followup === "true" ||
      analysis.patient_question === "true" ||
      analysis.patient_reached === "false" ||
      sentiment === "negative";

    let followUpReason;
    if (followUpNeeded) {
      if (analysis.schedule_followup === "true") {
        followUpReason = "Patient requested follow-up";
      } else if (analysis.patient_question === "true") {
        followUpReason = "Patient had unanswered questions";
      } else if (analysis.patient_reached === "false") {
        followUpReason = "Unable to reach patient";
      } else if (sentiment === "negative") {
        followUpReason = "Negative sentiment detected";
      }
    }

    return {
      sentiment,
      followUpNeeded,
      followUpReason,
    };
  } catch (error) {
    console.error("Error extracting call insights:", error);

    // Return default values on error
    return {
      sentiment: "neutral",
      followUpNeeded: false,
    };
  }
}
