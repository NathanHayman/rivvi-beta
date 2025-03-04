// src/lib/call/call-webhook-handler.ts - Improved version
import { PatientService } from "@/lib/patient/patient-service";
import { pusherServer } from "@/lib/pusher-server";
import { db } from "@/server/db";
import {
  calls,
  campaigns,
  campaignTemplates,
  organizations,
  rows,
  runs,
} from "@/server/db/schema";
import { RetellPostCallObjectRaw } from "@/types/retell";
import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, or, sql } from "drizzle-orm";

/**
 * Handle inbound webhook from Retell with better error handling
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
  console.log(
    `[WEBHOOK] Inbound call received for org ${orgId}:`,
    JSON.stringify(payload),
  );

  try {
    // Validate required fields with better error handling
    if (!payload.from_number) {
      console.error(`[WEBHOOK] Missing from_number in inbound webhook payload`);
      return {
        status: "error",
        variables: {
          error_occurred: true,
          error_message: "Missing caller phone number",
          organization_name: "Our organization", // Fallback to ensure call continues
        },
      };
    }

    if (!payload.to_number) {
      console.warn(
        `[WEBHOOK] Missing to_number in inbound webhook payload, using fallback`,
      );
      // Use a fallback to avoid disrupting call flow
      payload.to_number = payload.to_number || "unknown";
    }

    // Get organization details with error handling
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!organization) {
      console.error(`[WEBHOOK] Organization ${orgId} not found`);
      return {
        status: "error",
        variables: {
          error_occurred: true,
          error_message: "Organization not found",
          organization_name: "Our organization", // Fallback
        },
      };
    }

    // Find patient by phone number
    const patientService = new PatientService(db);
    const cleanPhone = payload.from_number.replace(/\D/g, "");

    console.log(`[WEBHOOK] Looking up patient by phone: ${cleanPhone}`);
    const patient = await patientService.findPatientByPhone(cleanPhone, orgId);

    // Create a minimal patient record if not found
    let patientId: string | null = patient?.id || null;
    if (!patient) {
      try {
        console.log(
          `[WEBHOOK] No existing patient found, creating minimal record`,
        );
        // Create a basic patient record with today's date as a placeholder DOB
        const today = new Date().toISOString().split("T")[0]; // Format as YYYY-MM-DD

        const patientResult = await patientService.findOrCreatePatient({
          firstName: "Unknown",
          lastName: "Caller",
          dob: today || "",
          phone: cleanPhone,
          orgId,
        });

        patientId = patientResult?.id || null;
        console.log(`[WEBHOOK] Created new patient with ID: ${patientId}`);
      } catch (error) {
        console.error("[WEBHOOK] Error in findOrCreatePatient:", error);
        // Continue with a null patientId if patient creation fails
        patientId = null;
      }
    } else {
      console.log(
        `[WEBHOOK] Found existing patient: ${patient.firstName} ${patient.lastName} (ID: ${patient.id})`,
      );
    }

    // Get recent outbound calls to this patient with error handling
    let recentCalls: any[] = [];
    if (patientId) {
      try {
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

        console.log(
          `[WEBHOOK] Found ${recentCalls.length} recent calls for patient`,
        );
      } catch (error) {
        console.error("[WEBHOOK] Error fetching recent calls:", error);
        recentCalls = [];
      }
    }

    // Get any active campaign information for inbound calls
    const [inboundCampaign] = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.orgId, orgId),
          eq(campaigns.direction, "inbound"),
          eq(campaigns.isActive, true),
          eq(campaigns.isDefaultInbound, true),
        ),
      );

    console.log(
      `[WEBHOOK] Default inbound campaign found: ${inboundCampaign?.name || "None"}`,
    );

    // Create inbound call record with better error handling
    try {
      // Ensure we have valid values for required fields
      if (!payload.agent_id) {
        // Try to use llm_id as a fallback if available
        if (payload.llm_id) {
          payload.agent_id = payload.llm_id;
          console.log(
            `[WEBHOOK] Using llm_id as agent_id fallback: ${payload.llm_id}`,
          );
        } else {
          console.warn(
            `[WEBHOOK] No agent_id provided in webhook for org ${orgId}. Using default value.`,
          );
          payload.agent_id = "default-inbound-agent";
        }
      }

      const agent_id = payload.agent_id;

      if (!payload.call_id) {
        payload.call_id = createId();
        console.log(`[WEBHOOK] Generated new call_id: ${payload.call_id}`);
      }

      const call_id = payload.call_id;

      // Insert call record with retry logic
      let insertedCall: { id: string } | null = null;
      try {
        const result = await db
          .insert(calls)
          .values({
            id: createId(), // Generate a unique ID
            orgId,
            patientId,
            fromNumber: payload.from_number,
            toNumber: payload.to_number,
            retellCallId: call_id,
            agentId: agent_id,
            direction: "inbound",
            status: "in-progress",
            campaignId: inboundCampaign?.id, // Link to inbound campaign if found
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        insertedCall = result[0] ? { id: result[0].id } : null;
        console.log(
          `[WEBHOOK] Successfully inserted call record: ${insertedCall?.id}`,
        );
      } catch (error) {
        console.error("[WEBHOOK] Error inserting call record:", error);

        // Try a simplified insert as a fallback
        try {
          const result = await db
            .insert(calls)
            .values({
              id: createId(),
              orgId,
              fromNumber: payload.from_number,
              toNumber: payload.to_number,
              retellCallId: call_id,
              agentId: agent_id,
              direction: "inbound",
              status: "in-progress",
            })
            .returning();

          insertedCall = result[0] ? { id: result[0].id } : null;
          console.log(
            `[WEBHOOK] Fallback call record insert succeeded: ${insertedCall?.id}`,
          );
        } catch (fallbackError) {
          console.error(
            "[WEBHOOK] Fallback call insert also failed:",
            fallbackError,
          );
          throw new Error(
            `Failed to create inbound call record: ${fallbackError.message}`,
          );
        }
      }

      // Create context for agent with important fallbacks
      const context: Record<string, any> = {
        organization_name: organization.name || "Our organization",
        inbound_call: true,
      };

      if (patient) {
        context.patient_first_name = patient.firstName;
        context.patient_last_name = patient.lastName;
        context.patient_phone = patient.primaryPhone;
        context.patient_exists = true;

        // Also add alternate variable names for compatibility
        context.first_name = patient.firstName;
        context.last_name = patient.lastName;
        context.phone = patient.primaryPhone;
      } else {
        context.patient_exists = false;
        context.caller_phone = payload.from_number;

        // Provide fallback values
        context.patient_first_name = "Unknown";
        context.patient_last_name = "Caller";
        context.first_name = "Unknown";
        context.last_name = "Caller";
      }

      // Add recent call information if available
      if (recentCalls.length > 0) {
        context.recent_calls_count = recentCalls.length;

        // Format call data in a reliable way
        const callSummaries = recentCalls.map((call, index) => {
          const date = call.createdAt
            ? new Date(call.createdAt).toLocaleDateString()
            : "unknown date";
          const campaign = call.campaignName || "Unknown campaign";
          const reachedStatus =
            call.analysis?.patient_reached === true ||
            call.analysis?.patientReached === true ||
            call.analysis?.patient_reached === "true" ||
            call.analysis?.patientReached === "true";

          return `Call ${index + 1}: ${date} - ${campaign} - ${reachedStatus ? "Patient was reached" : "Patient was not reached"}`;
        });

        context.recent_call_summary = callSummaries.join("; ");

        // Add information about most recent call
        const lastCall = recentCalls[0];
        if (lastCall) {
          context.last_call_date = lastCall.createdAt
            ? new Date(lastCall.createdAt).toLocaleDateString()
            : "unknown date";

          context.last_call_campaign = lastCall.campaignName || "Unknown";

          // Check all possible formats for patient_reached
          context.last_call_reached_patient =
            lastCall.analysis?.patient_reached === true ||
            lastCall.analysis?.patientReached === true ||
            lastCall.analysis?.patient_reached === "true" ||
            lastCall.analysis?.patientReached === "true";

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
        }
      } else {
        context.recent_calls_count = 0;
        context.is_first_call = true;
      }

      // Send real-time update
      try {
        await pusherServer.trigger(`org-${orgId}`, "inbound-call", {
          callId: insertedCall?.id ?? call_id,
          patientId,
          fromNumber: payload.from_number,
          toNumber: payload.to_number,
          retellCallId: call_id,
          time: new Date().toISOString(),
        });
        console.log(`[WEBHOOK] Sent Pusher event for inbound call`);
      } catch (pusherError) {
        console.error(
          "[WEBHOOK] Error sending Pusher notification:",
          pusherError,
        );
        // Continue even if Pusher fails
      }

      console.log("[WEBHOOK] Inbound call webhook processed successfully");
      console.log("[WEBHOOK] Returning context:", context);

      return {
        status: "success",
        call_id: insertedCall?.id ?? call_id,
        variables: context,
      };
    } catch (error) {
      console.error("[WEBHOOK] Error processing inbound webhook:", error);

      // Return minimal context to avoid disrupting the call
      return {
        status: "partial_success",
        variables: {
          organization_name: organization?.name || "Our organization",
          error_occurred: true,
          patient_exists: false,
          patient_first_name: "Unknown",
          patient_last_name: "Caller",
          first_name: "Unknown",
          last_name: "Caller",
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } catch (error) {
    console.error(
      `[WEBHOOK] Unhandled error in inbound webhook handler:`,
      error,
    );

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
 * Handler for Retell post-call webhook with improved error handling
 * Processes call results and updates database records
 */
export async function handlePostCallWebhook(
  orgId: string,
  campaignId: string | null,
  payload: RetellPostCallObjectRaw,
) {
  console.log(
    `[WEBHOOK] Post-call webhook received for org ${orgId}, campaign ${campaignId || "unknown"}`,
  );

  try {
    // Extract key fields with fallbacks
    const {
      call_id: retellCallId,
      direction = "outbound",
      from_number: fromNumber = "",
      to_number: toNumber = "",
      agent_id = "",
      metadata = {},
      call_status: callStatus = "completed",
      recording_url: recordingUrl = null,
      disconnection_reason: disconnectionReason = null,
      call_analysis = {} as Record<string, any>,
    } = payload;

    if (!retellCallId) {
      console.error("[WEBHOOK] Missing call_id in post-call webhook payload");
      return { status: "error", error: "Missing call_id in webhook payload" };
    }

    console.log(
      `[WEBHOOK] Processing post-call webhook for call ${retellCallId}`,
    );

    // Determine patient for this call with improved error handling
    let patientId: string | null = null;

    // For outbound calls, get patient ID from metadata
    if (direction === "outbound" && metadata) {
      patientId = metadata.patientId || metadata.patient_id || null;
      console.log(`[WEBHOOK] Extracted patient ID from metadata: ${patientId}`);
    }
    // For inbound calls, try to find patient by phone number
    else if (direction === "inbound" && fromNumber) {
      console.log(
        `[WEBHOOK] Looking up patient by phone number for inbound call`,
      );

      try {
        // Determine which number is the patient's
        // For inbound calls, the caller's number is in fromNumber
        const patientPhone = fromNumber;
        const cleanPhone = patientPhone.replace(/\D/g, "");

        if (cleanPhone) {
          // Try to find patient by phone using the service
          const patientService = new PatientService(db);
          const patient = await patientService.findPatientByPhone(
            cleanPhone,
            orgId,
          );

          if (patient) {
            patientId = patient.id;
            console.log(
              `[WEBHOOK] Found patient ${patientId} by phone number ${cleanPhone}`,
            );
          } else {
            console.log(
              `[WEBHOOK] No patient found with phone number ${cleanPhone}`,
            );
          }
        }
      } catch (error) {
        console.error("[WEBHOOK] Error finding patient by phone:", error);
      }
    }

    // 1. Check if the call exists, update if it does, create if not
    console.log(
      `[WEBHOOK] Looking up existing call record for ${retellCallId}`,
    );

    const [existingCall] = await db
      .select()
      .from(calls)
      .where(eq(calls.retellCallId, retellCallId));

    let callId: string;
    let rowId: string | null = null;
    let runId: string | null = null;

    if (existingCall) {
      console.log(`[WEBHOOK] Found existing call record ${existingCall.id}`);

      callId = existingCall.id;
      rowId = existingCall.rowId;
      runId = existingCall.runId;

      // If we found a patient but the existing call doesn't have one, update it
      if (patientId && !existingCall.patientId) {
        console.log(
          `[WEBHOOK] Updating call with newly found patient ID ${patientId}`,
        );

        await db
          .update(calls)
          .set({ patientId, updatedAt: new Date() })
          .where(eq(calls.id, callId));
      }
    } else {
      console.log(`[WEBHOOK] No existing call found, creating new record`);

      // Create the call with proper metadata initialization
      const [newCall] = await db
        .insert(calls)
        .values({
          id: createId(),
          orgId,
          retellCallId,
          patientId,
          toNumber,
          fromNumber,
          direction: direction,
          status:
            callStatus === "completed"
              ? "completed"
              : callStatus === "failed"
                ? "failed"
                : "in-progress",
          agentId: agent_id || "unknown",
          campaignId: campaignId || null,
          metadata: {
            ...(metadata || {}),
            campaignId: campaignId || null,
            webhook_received: true,
            webhook_time: new Date().toISOString(),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      callId = newCall.id;
      rowId = metadata?.rowId || null;
      runId = metadata?.runId || null;

      console.log(`[WEBHOOK] Created new call record ${callId}`);

      // If the call came with a rowId in metadata but we didn't set it directly, update the call
      if (metadata?.rowId && !newCall.rowId) {
        console.log(`[WEBHOOK] Updating call with row ID ${metadata.rowId}`);

        await db
          .update(calls)
          .set({ rowId: metadata.rowId })
          .where(eq(calls.id, callId));
      }

      // Same for runId
      if (metadata?.runId && !newCall.runId) {
        console.log(`[WEBHOOK] Updating call with run ID ${metadata.runId}`);

        await db
          .update(calls)
          .set({ runId: metadata.runId })
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

    // Process campaign-specific configuration if available
    let campaignConfig = null;
    if (campaignId) {
      console.log(
        `[WEBHOOK] Looking up campaign configuration for ${campaignId}`,
      );

      try {
        const [campaign] = await db
          .select()
          .from(campaigns)
          .where(and(eq(campaigns.id, campaignId), eq(campaigns.orgId, orgId)));

        if (campaign) {
          // Get template for this campaign
          const [template] = await db
            .select()
            .from(campaignTemplates)
            .where(eq(campaignTemplates.id, campaign.templateId));

          if (template) {
            campaignConfig = {
              name: campaign.name,
              direction: campaign.direction,
              analysisConfig: template.analysisConfig,
            };

            console.log(
              `[WEBHOOK] Found campaign config with ${template.analysisConfig?.standard?.fields?.length || 0} standard fields`,
            );
          }
        }
      } catch (error) {
        console.error("[WEBHOOK] Error fetching campaign config:", error);
      }
    }

    // Process analysis data with better error handling
    let processedAnalysis: Record<string, any> = {};

    try {
      // Start with the custom analysis data if available
      processedAnalysis = call_analysis?.custom_analysis_data || {};

      // If voicemail was detected, mark it
      if (call_analysis?.in_voicemail === true) {
        processedAnalysis.voicemail_detected = true;
      }
    } catch (error) {
      console.error("[WEBHOOK] Error extracting analysis data:", error);
      processedAnalysis = {}; // Fallback to empty object
    }

    // Update call record with complete information using error handling
    try {
      await db
        .update(calls)
        .set({
          status:
            callStatus === "completed"
              ? "completed"
              : callStatus === "failed"
                ? "failed"
                : call.status,
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
            callStatus === "failed"
              ? disconnectionReason || "Call failed"
              : null,
          metadata: {
            ...call.metadata,
            campaignId: campaignId || call.metadata?.campaignId,
            insights: extractCallInsights({
              transcript: call_analysis?.transcript,
              analysis: processedAnalysis,
            }),
            updated_at: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(calls.id, call.id));

      console.log(
        `[WEBHOOK] Updated call record ${call.id} with analysis and transcript data`,
      );
    } catch (error) {
      console.error("[WEBHOOK] Error updating call record:", error);
    }

    // If this is a call associated with a row, update the row status
    if (rowId) {
      console.log(`[WEBHOOK] Updating associated row ${rowId}`);

      try {
        await db
          .update(rows)
          .set({
            status:
              callStatus === "completed"
                ? "completed"
                : callStatus === "failed"
                  ? "failed"
                  : "in-progress",
            error:
              callStatus === "failed"
                ? disconnectionReason || "Call failed"
                : null,
            analysis: processedAnalysis,
            metadata: {
              ...(call.metadata && typeof call.metadata === "object"
                ? call.metadata
                : {}),
              campaignId: campaignId || null,
              callCompleted: callStatus === "completed",
              callInsights: extractCallInsights({
                transcript: call_analysis?.transcript,
                analysis: processedAnalysis,
              }),
              lastUpdated: new Date().toISOString(),
            },
            updatedAt: new Date(),
          } as Partial<typeof rows.$inferInsert>)
          .where(eq(rows.id, rowId));

        console.log(`[WEBHOOK] Row ${rowId} updated with call results`);
      } catch (error) {
        console.error("[WEBHOOK] Error updating row:", error);
      }
    }

    // If the call has a run ID, update run metrics
    if (runId) {
      console.log(`[WEBHOOK] Updating metrics for run ${runId}`);

      try {
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
            if (call.status === "in-progress") {
              metadata.calls.calling = Math.max(
                0,
                (metadata.calls.calling || 0) - 1,
              );
            }

            // Check if patient was reached - handle multiple possible field names
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

            // Check common conversion field names
            const commonConversionFields = [
              "appointment_confirmed",
              "appointmentConfirmed",
              "converted",
              "conversion",
              "call_successful",
              "goal_achieved",
              "goal_met",
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

            if (conversionValue) {
              metadata.calls.converted = (metadata.calls.converted || 0) + 1;
            }
          } else if (callStatus === "failed") {
            metadata.calls.failed = (metadata.calls.failed || 0) + 1;

            // If call was previously calling, decrement that counter
            if (call.status === "in-progress") {
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
              metadata: metadata,
              updatedAt: new Date(),
            } as Partial<typeof runs.$inferInsert>)
            .where(eq(runs.id, runId));

          console.log(`[WEBHOOK] Updated run ${runId} metrics`);

          // Check if run is complete (all rows processed)
          const [{ value: pendingRows }] = (await db
            .select({ value: sql`COUNT(*)` })
            .from(rows)
            .where(
              and(
                eq(rows.runId, runId),
                or(eq(rows.status, "pending"), eq(rows.status, "calling")),
              ),
            )) as [{ value: number }];

          if (Number(pendingRows) === 0) {
            console.log(
              `[WEBHOOK] No pending rows left, marking run ${runId} as completed`,
            );

            // Calculate duration if we have start time
            let duration: number | undefined;
            if (metadata.run?.startTime) {
              duration = Math.floor(
                (Date.now() - new Date(metadata.run.startTime).getTime()) /
                  1000,
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
                },
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

            console.log(`[WEBHOOK] Run ${runId} marked as completed`);
          }

          // Send real-time update for run metrics
          await pusherServer.trigger(`run-${runId}`, "metrics-updated", {
            runId,
            metrics: metadata,
          });
        }
      } catch (error) {
        console.error("[WEBHOOK] Error updating run metrics:", error);
      }
    }

    // Send real-time updates with error handling
    try {
      // Extract insights for the notification
      const insights = extractCallInsights({
        transcript: call_analysis?.transcript,
        analysis: processedAnalysis,
      });

      // Org-level notification
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

      // Campaign-specific notification
      if (campaignId) {
        await pusherServer.trigger(`campaign-${campaignId}`, "call-completed", {
          callId: call.id,
          status: callStatus,
          patientId,
          analysis: processedAnalysis,
          insights,
        });
      }

      // Run-specific notification
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

      console.log(`[WEBHOOK] Sent all real-time updates for call ${call.id}`);
    } catch (error) {
      console.error("[WEBHOOK] Error sending Pusher notifications:", error);
    }

    console.log(
      `[WEBHOOK] Post-call webhook processed successfully for call ${retellCallId}`,
    );

    return {
      status: "success",
      callId: call.id,
      patientId,
      message: "Call data processed successfully",
      insights: extractCallInsights({
        transcript: call_analysis?.transcript,
        analysis: processedAnalysis,
      }),
    };
  } catch (error) {
    console.error(`[WEBHOOK] Error handling post-call webhook:`, error);

    // Return error response but don't interrupt the flow
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      processed: false,
    };
  }
}

/**
 * Extract insights from a call transcript using pattern matching and NLP
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
