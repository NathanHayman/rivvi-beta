// src/lib/webhook-handler.ts
import { PatientService } from "@/lib/patient/patient-service";
import { pusherServer } from "@/lib/pusher-server";
import { db } from "@/server/db";
import {
  calls,
  campaigns,
  campaignTemplates,
  organizationPatients,
  organizations,
  patients,
  rows,
  runs,
} from "@/server/db/schema";
import { RetellPostCallObjectRaw } from "@/types/retell";
import { and, desc, eq, or, sql } from "drizzle-orm";

export type TRetellCallStatus = "ongoing" | "registered" | "error" | "ended";
export type TRowStatus = "pending" | "calling" | "completed" | "failed";
export type TCallStatus =
  | "in-progress"
  | "completed"
  | "failed"
  | "voicemail"
  | "no-answer"
  | "pending";

export const getStatus = (
  type: "call" | "row",
  status: TRetellCallStatus,
): TCallStatus | TRowStatus => {
  if (type === "call") {
    switch (status) {
      case "ongoing":
        return "in-progress";
      case "registered":
        return "pending";
      case "error":
        return "failed";
      case "ended":
        return "completed";
      default:
        return "pending";
    }
  } else {
    switch (status) {
      case "ongoing":
        return "calling";
      case "registered":
        return "pending";
      case "error":
        return "failed";
      case "ended":
        return "completed";
      default:
        return "pending";
    }
  }
};

/**
 * Handle inbound webhook from Retell
 * This processes incoming calls, identifies patients, and provides context
 */
export async function handleInboundWebhook(
  orgId: string,
  payload: {
    from_number: string;
    to_number: string;
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
    const cleanPhone = payload.from_number.replace("+1", "");

    const patient = await patientService.findPatientByPhone(cleanPhone, orgId);

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
          eq(campaigns.direction, "inbound"),
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
            agentId: agent_id,
            direction: "inbound",
            status: getStatus("call", "registered"),
          } as Partial<typeof calls.$inferInsert>)
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
        callId: insertedCall?.id,
        patientId,
        fromNumber: payload.from_number,
        toNumber: payload.to_number,
        time: new Date().toISOString(),
      });

      console.log("Inbound call webhook processed successfully");
      console.log("Context:", context);

      return {
        status: "success",
        call_id: insertedCall?.id,
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
 * Metadata will only be present for outbound calls
 */
/**
 * Handler for Retell post-call webhook
 * Processes call results and updates database records
 * Expects webhook payload from call_analyzed event
 * Metadata will only be present for outbound calls
 */
export async function handlePostCallWebhook(
  orgId: string,
  campaignId: string | null,
  payload: RetellPostCallObjectRaw,
) {
  try {
    console.log(
      `Handling post-call webhook for org ${orgId}, campaign ${campaignId || "unknown"}:`,
      JSON.stringify(payload),
    );

    const {
      call_id: retellCallId,
      direction,
      from_number: fromNumber,
      to_number: toNumber,
      agent_id,
      metadata,
      call_status: callStatus,
      recording_url: recordingUrl,
      disconnection_reason: disconnectionReason,
      call_analysis,
    } = payload;

    // Ensure we have an agent_id, use a default if not provided
    const agentId = agent_id || "default_agent";
    console.log(`Using agent_id: ${agentId} for call ${retellCallId}`);

    // Determine patient for this call
    let patientId: string | null = null;

    // For outbound calls, get patient ID from metadata
    if (direction === "outbound" && metadata) {
      patientId = metadata.patientId || metadata.patient_id || null;
    }
    // For inbound calls, try to find patient by phone number
    else if (direction === "inbound") {
      // Determine which number is the patient's
      // For inbound calls, the caller's number is in fromNumber
      const patientPhone = fromNumber;

      if (patientPhone) {
        // Try to find patient by phone (check both primary and secondary phone)
        const [patient] = await db
          .select()
          .from(patients)
          .where(
            or(
              eq(patients.primaryPhone, patientPhone),
              eq(patients.secondaryPhone, patientPhone),
            ),
          );

        if (patient) {
          // Found a patient, now verify they're associated with this organization
          const [orgPatient] = await db
            .select()
            .from(organizationPatients)
            .where(
              and(
                eq(organizationPatients.patientId, patient.id),
                eq(organizationPatients.orgId, orgId),
                eq(organizationPatients.isActive, true),
              ),
            );

          if (orgPatient) {
            patientId = patient.id;
          } else {
            console.log(
              `Patient ${patient.id} found but not associated with org ${orgId}`,
            );
          }
        } else {
          console.log(`No patient found with phone number ${patientPhone}`);
        }
      }
    }

    // 1. Check if the call exists, update if it does, create if not
    const [existingCall] = await db
      .select()
      .from(calls)
      .where(and(eq(calls.retellCallId, retellCallId), eq(calls.orgId, orgId)));

    let callId: string;
    let rowId: string | null = null;
    let runId: string | null = null;

    if (existingCall) {
      callId = existingCall.id;
      rowId = existingCall.rowId;
      runId = existingCall.runId;

      // If we found a patient but the existing call doesn't have one, update it
      if (patientId && !existingCall.patientId) {
        await db
          .update(calls)
          .set({ patientId } as Partial<typeof calls.$inferInsert>)
          .where(eq(calls.id, callId));
      }
    } else {
      // Create the call with proper metadata initialization
      const [newCall] = await db
        .insert(calls)
        .values({
          orgId,
          retellCallId,
          patientId,
          toNumber,
          fromNumber,
          direction: direction,
          status: getStatus("call", callStatus as TRetellCallStatus),
          agentId,
          campaignId: campaignId || null,
          metadata: {
            ...(metadata || {}),
            campaignId: campaignId || null,
          },
        } as Partial<typeof calls.$inferInsert>)
        .returning();

      callId = newCall.id;
      rowId = metadata?.rowId || null;
      runId = metadata?.runId || null;

      // If the call came with a rowId in metadata but we didn't set it directly, update the call
      if (metadata?.rowId && !newCall.rowId) {
        await db
          .update(calls)
          .set({ rowId: metadata.rowId } as Partial<typeof calls.$inferInsert>)
          .where(eq(calls.id, callId));
      }

      // Same for runId
      if (metadata?.runId && !newCall.runId) {
        await db
          .update(calls)
          .set({ runId: metadata.runId } as Partial<typeof calls.$inferInsert>)
          .where(eq(calls.id, callId));
      }
    }

    // Fetch the complete call record again to make sure we have latest data
    const [call] = await db.select().from(calls).where(eq(calls.id, callId));

    if (!call) {
      throw new Error(`Call ${callId} not found after creation/lookup`);
    }

    // Re-assign these values from the latest call record
    rowId = call.rowId;
    runId = call.runId;

    // Fetch campaign configuration if campaignId is provided
    let campaignConfig = null;
    if (campaignId) {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.orgId, orgId)));

      // Also get their templates
      const [template] = await db
        .select()
        .from(campaignTemplates)
        .where(eq(campaignTemplates.id, campaign.templateId));

      campaignConfig = template
        ? {
            agentId: template.agentId,
            basePrompt: template.basePrompt,
            voicemailMessage: template.voicemailMessage,
            variables: template.variablesConfig,
            analysis: template.analysisConfig,
          }
        : null;
    }

    // Process analysis data with campaign-specific validation
    let processedAnalysis: Record<string, any> =
      call_analysis?.custom_analysis_data || {};

    // If voicemail was detected, mark it in the analysis
    if (call_analysis?.in_voicemail === true) {
      processedAnalysis = {
        ...processedAnalysis,
        voicemail_detected: true,
      };
    }

    if (campaignConfig && campaignConfig.analysis) {
      // Apply campaign-specific analysis processing
      try {
        const analysisSchema = campaignConfig.analysis;

        // Process standard fields
        if (analysisSchema.standard?.fields) {
          // Validate standard fields if defined in the campaign config
          for (const field of analysisSchema.standard.fields) {
            if (
              field.required &&
              (!(field.key in processedAnalysis) ||
                processedAnalysis[field.key] === undefined ||
                processedAnalysis[field.key] === null)
            ) {
              console.warn(
                `Required field ${field.key} missing from analysis data`,
              );
            }
          }
        }

        // Process campaign-specific fields
        if (analysisSchema.campaign?.fields) {
          // Track campaign-specific KPIs
          const mainKPIs = analysisSchema.campaign.fields
            .filter((field) => field.isMainKPI)
            .map((field) => field.key);

          // Add campaign KPI tracking metadata
          if (mainKPIs.length > 0) {
            const kpiValues: Record<string, any> = {};

            // Extract KPI values from analysis data
            for (const kpiKey of mainKPIs) {
              if (typeof kpiKey === "string" && kpiKey in processedAnalysis) {
                kpiValues[kpiKey] = processedAnalysis[kpiKey];
              }
            }

            // Add KPI values to processed analysis
            if (Object.keys(kpiValues).length > 0) {
              processedAnalysis = {
                ...processedAnalysis,
                _campaignKPIs: kpiValues,
              };
            }
          }
        }
      } catch (err) {
        console.warn(`Error processing campaign-specific analysis data:`, err);
      }
    }

    // Extract insights from transcript and analysis
    const insights = extractCallInsights({
      transcript: call_analysis?.transcript,
      analysis: processedAnalysis,
    });

    // Update call record with complete information
    await db
      .update(calls)
      .set({
        status: getStatus("call", callStatus as TRetellCallStatus),
        recordingUrl: recordingUrl || call.recordingUrl,
        transcript: call_analysis?.transcript || call.transcript,
        analysis: processedAnalysis,
        duration: Math.round(
          (payload.duration_ms || call.duration || 0) / 1000,
        ),
        startTime: payload.start_timestamp
          ? new Date(payload.start_timestamp)
          : call.startTime,
        endTime: payload.end_timestamp
          ? new Date(payload.end_timestamp)
          : call.endTime,
        error:
          getStatus("call", callStatus as TRetellCallStatus) === "failed"
            ? disconnectionReason || "Call failed"
            : null,
        metadata: {
          ...call.metadata,
          campaignId: campaignId || call.metadata?.campaignId,
          insights: insights,
        },
        updatedAt: new Date(),
      } as Partial<typeof calls.$inferInsert>)
      .where(eq(calls.id, call.id));

    // If this is a call associated with a row, update the row status
    if (rowId) {
      await db
        .update(rows)
        .set({
          status: getStatus("row", callStatus as TRetellCallStatus),
          error:
            getStatus("row", callStatus as TRetellCallStatus) === "failed"
              ? disconnectionReason || "Call failed"
              : null,
          analysis: processedAnalysis,
          metadata: {
            ...(call.metadata && typeof call.metadata === "object"
              ? call.metadata
              : {}),
            campaignId: campaignId || null,
            callCompleted:
              getStatus("row", callStatus as TRetellCallStatus) === "completed",
            callInsights: insights,
          },
          updatedAt: new Date(),
        } as Partial<typeof rows.$inferInsert>)
        .where(eq(rows.id, rowId));
    }

    // If the call has a run ID, update run metrics
    if (runId) {
      // Get the run
      const [run] = await db.select().from(runs).where(eq(runs.id, runId));

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
            connected: 0,
            converted: 0,
            pending: 0,
            calling: 0,
          };
        }

        // Update metrics
        if (callStatus === "completed") {
          metadata.calls.completed = (metadata.calls.completed || 0) + 1;

          // If call was previously calling, decrement that counter
          if (
            getStatus("call", callStatus as TRetellCallStatus) === "calling" ||
            getStatus("call", callStatus as TRetellCallStatus) === "in-progress"
          ) {
            metadata.calls.calling = Math.max(
              0,
              (metadata.calls.calling || 0) - 1,
            );
          }

          // Check if patient was reached
          const patientReachedValue =
            processedAnalysis.patient_reached !== undefined
              ? processedAnalysis.patient_reached
              : processedAnalysis.patientReached;

          const wasReached =
            patientReachedValue === true ||
            patientReachedValue === "true" ||
            patientReachedValue === "yes";

          if (wasReached) {
            metadata.calls.connected = (metadata.calls.connected || 0) + 1;
          }

          // Check if voicemail was left
          if (
            call_analysis?.in_voicemail === true ||
            processedAnalysis.voicemail_detected === true
          ) {
            metadata.calls.voicemail = (metadata.calls.voicemail || 0) + 1;
          }

          // Check for conversion if defined in analysis data
          let conversionValue = false;

          // First check if there's a main KPI defined in the campaign config
          if (campaignConfig?.postCall?.campaign?.fields) {
            const conversionField =
              campaignConfig.postCall.campaign.fields.find(
                (field) => field.isMainKPI && field.key,
              );

            if (conversionField && conversionField.key) {
              // Use the main KPI field as the conversion metric
              const kpiValue = processedAnalysis[conversionField.key];

              conversionValue =
                kpiValue === true ||
                kpiValue === "true" ||
                kpiValue === "yes" ||
                kpiValue === 1;
            }
          }

          // If no main KPI was found or it wasn't truthy, fallback to common fields
          if (!conversionValue) {
            // Check common conversion field names
            const commonConversionFields = [
              "appointment_confirmed",
              "appointmentConfirmed",
              "converted",
              "conversion",
              "call_successful",
            ];

            for (const field of commonConversionFields) {
              const value = processedAnalysis[field];
              if (
                value === true ||
                value === "true" ||
                value === "yes" ||
                value === 1
              ) {
                conversionValue = true;
                break;
              }
            }
          }

          if (conversionValue) {
            metadata.calls.converted = (metadata.calls.converted || 0) + 1;
          }
        } else if (
          getStatus("call", callStatus as TRetellCallStatus) === "failed"
        ) {
          metadata.calls.failed = (metadata.calls.failed || 0) + 1;

          // If call was previously calling, decrement that counter
          if (
            getStatus("call", callStatus as TRetellCallStatus) === "calling" ||
            getStatus("call", callStatus as TRetellCallStatus) === "in-progress"
          ) {
            metadata.calls.calling = Math.max(
              0,
              (metadata.calls.calling || 0) - 1,
            );
          }
        }

        // Update run metadata
        await db
          .update(runs)
          .set({
            metadata: metadata as any,
            updatedAt: new Date(),
          } as Partial<typeof runs.$inferInsert>)
          .where(eq(runs.id, runId));

        // Check if run is complete (all rows processed)
        const [{ value: pendingRows }] = (await db
          .select({
            value: sql`COUNT(*)`.mapWith(Number),
          })
          .from(rows)
          .where(
            and(
              eq(rows.runId, runId),
              or(eq(rows.status, "pending"), eq(rows.status, "calling")),
            ),
          )) as [{ value: number }];

        if (pendingRows === 0) {
          // Calculate duration if we have start time
          let duration: number | undefined;
          if (metadata.run?.startTime) {
            duration = Math.floor(
              (Date.now() - new Date(metadata.run.startTime).getTime()) / 1000,
            );
          }

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
                  duration,
                  completedAt: new Date().toISOString(),
                },
              } as any,
              updatedAt: new Date(),
            } as Partial<typeof runs.$inferInsert>)
            .where(eq(runs.id, runId));

          // Send real-time update for run completion
          await pusherServer.trigger(`org-${orgId}`, "run-updated", {
            runId,
            status: "completed",
            metadata: {
              ...metadata,
              run: {
                ...metadata.run,
                endTime: new Date().toISOString(),
                duration,
                completedAt: new Date().toISOString(),
              },
            },
          });
        }

        // Send real-time update for run metrics
        await pusherServer.trigger(`run-${runId}`, "metrics-updated", {
          runId,
          metrics: metadata,
        });
      }
    }

    // Send real-time updates
    await pusherServer.trigger(`org-${orgId}`, "call-updated", {
      callId: call.id,
      status: callStatus,
      patientId,
      runId,
      metadata: {
        campaignId: campaignId || null,
      },
      analysis: processedAnalysis,
      insights,
    });

    // Add campaign-specific channel updates
    if (campaignId) {
      await pusherServer.trigger(`campaign-${campaignId}`, "call-completed", {
        callId: call.id,
        status: callStatus,
        patientId,
        analysis: processedAnalysis,
        insights,
      });
    }

    if (runId) {
      await pusherServer.trigger(`run-${runId}`, "call-completed", {
        callId: call.id,
        status: callStatus,
        rowId,
        metadata: {
          campaignId: campaignId || null,
        },
        analysis: processedAnalysis,
        insights,
      });
    }

    return {
      status: "success",
      callId: call.id,
      patientId,
      message: "Call data processed successfully",
      insights,
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

    // Check if patient was reached - normalize different field names
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
      processedAnalysis.in_voicemail === true;

    // Determine if follow-up is needed - check multiple possible conditions
    const scheduleFollowUp =
      processedAnalysis.schedule_followup === true ||
      processedAnalysis.scheduleFollowup === true ||
      processedAnalysis.needs_followup === true ||
      processedAnalysis.needsFollowup === true ||
      processedAnalysis.schedule_followup === "true" ||
      processedAnalysis.scheduleFollowup === "true";

    const patientHadQuestions =
      processedAnalysis.patient_question === true ||
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

    // Determine the reason for follow-up
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
}
