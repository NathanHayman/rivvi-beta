// src/lib/call/call-webhook-handler.ts - Improved version
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
import { PatientService } from "@/services/patient";
import { TCall } from "@/types/db";
import {
  RetellInboundWebhookPayload,
  RetellInboundWebhookResponse,
  RetellPostCallObjectRaw,
} from "@/types/retell";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { generateContextInstructions } from "../ai/context";

export type RetellCallStatus = "registered" | "ongoing" | "ended" | "error";
export type RowStatus =
  | "pending"
  | "calling"
  | "completed"
  | "failed"
  | "skipped";
export type CallStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "failed"
  | "voicemail"
  | "no-answer";

function getStatus(
  type: "call" | "row",
  status: RetellCallStatus,
): CallStatus | RowStatus {
  if (type === "call") {
    switch (status) {
      case "registered":
        return "in-progress";
      case "ongoing":
        return "in-progress";
      case "ended":
        return "completed";
      case "error":
        return "failed";
      default:
        return "pending";
    }
  } else {
    switch (status) {
      case "ongoing":
        return "calling";
      case "registered":
        return "pending";
      case "ended":
        return "completed";
      case "error":
        return "failed";
      default:
        return "pending";
    }
  }
}

/**
 * Handle inbound webhook from Retell with better error handling
 * This processes incoming calls, identifies patients, and provides context
 */
export async function handleInboundWebhook(
  orgId: string,
  payload: RetellInboundWebhookPayload,
): Promise<RetellInboundWebhookResponse> {
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
        message: "Missing caller phone number",
        error: "Missing caller phone number",
        call_inbound: {
          override_agent_id: null,
          dynamic_variables: {
            error_occurred: true,
            error_message: "Missing caller phone number",
            organization_name: "Our organization", // Fallback to ensure call continues
          },
        },
        metadata: {},
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
        message: "Organization not found",
        error: "Organization not found",
        call_inbound: {
          override_agent_id: null,
          dynamic_variables: {
            error_occurred: true,
            error_message: "Organization not found",
            organization_name: "Our organization", // Fallback
          },
        },
        metadata: {},
      };
    }

    // Find patient by phone number
    const patientService = new PatientService(db);
    const cleanPhone = payload.from_number;

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

    // Get the most recent outbound calls to this patient - modified to focus on the most recent one
    let mostRecentOutboundCall = null;
    let rowData = null;
    let campaignData = null;
    let templateData = null;

    if (patientId) {
      try {
        // Get the most recent outbound call for this patient
        const recentCalls = await db
          .select({
            call: calls,
            run: runs,
            campaign: campaigns,
            row: rows,
          })
          .from(calls)
          .leftJoin(runs, eq(calls.runId, runs.id))
          .leftJoin(campaigns, eq(runs.campaignId, campaigns.id))
          .leftJoin(rows, eq(calls.rowId, rows.id))
          .where(
            and(
              eq(calls.patientId, patientId),
              eq(calls.orgId, orgId),
              eq(calls.direction, "outbound"),
              // Preferably get completed/successful calls
              or(
                eq(calls.status, "completed"),
                eq(calls.status, "in-progress"),
                eq(calls.status, "pending"),
              ),
            ),
          )
          .orderBy(desc(calls.createdAt))
          .limit(1);

        if (recentCalls.length > 0) {
          mostRecentOutboundCall = recentCalls[0].call;
          rowData = recentCalls[0].row;
          campaignData = recentCalls[0].campaign;

          // Get the campaign template to access the agent ID
          if (campaignData && campaignData.templateId) {
            const [template] = await db
              .select()
              .from(campaignTemplates)
              .where(eq(campaignTemplates.id, campaignData.templateId));

            templateData = template;
          }

          console.log(
            `[WEBHOOK] Found most recent outbound call (${mostRecentOutboundCall.id}) with campaign "${campaignData?.name || "unknown"}"`,
          );
        } else {
          console.log(`[WEBHOOK] No recent outbound calls found for patient`);
        }
      } catch (error) {
        console.error("[WEBHOOK] Error fetching recent calls:", error);
      }
    }

    // Determine which agent ID to use and variables to pass
    let overrideAgentId = null;
    let dynamicVariables: Record<string, any> = {};
    let metadata: Record<string, any> = {
      orgId,
      patientId,
    };

    // If we found a recent outbound call with a template, use its agent ID and variables
    if (templateData && rowData) {
      overrideAgentId = templateData.agentId;

      console.log(
        `[WEBHOOK] Overriding agent ID to ${overrideAgentId} from most recent campaign`,
      );

      // Use variables from the row data
      dynamicVariables = {
        ...rowData.variables,
        // Add organization info
        organization_name: organization.name || "Our organization",
        // Add patient info
        patient_first_name: patient?.firstName || "Unknown",
        patient_last_name: patient?.lastName || "Unknown",
        patient_phone: patient?.primaryPhone || cleanPhone,
        // For compatibility with different templates
        first_name: patient?.firstName || "Unknown",
        last_name: patient?.lastName || "Unknown",
        phone: patient?.primaryPhone || cleanPhone,
        // Indicate this is an inbound call
        inbound_call: true,
        // Include campaign info
        campaign_name: campaignData?.name || "Unknown",
        // Include previous call info if available
        previous_call_id: mostRecentOutboundCall?.id || null,
        is_return_call: true,
      };

      // Include important IDs in metadata for post-call processing
      metadata = {
        ...metadata,
        rowId: rowData.id,
        runId: mostRecentOutboundCall?.runId || null,
        campaignId: campaignData?.id || null,
        templateId: templateData.id,
        isReturnCall: true,
        previousCallId: mostRecentOutboundCall?.id || null,
      };

      console.log(`[WEBHOOK] Using variables and row data from previous call`);
    } else {
      // Fall back to default inbound handling if no recent outbound call was found
      console.log(
        `[WEBHOOK] No recent outbound call found, using default inbound handling`,
      );

      // Get any active default inbound campaign
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

      if (inboundCampaign) {
        console.log(
          `[WEBHOOK] Using default inbound campaign: ${inboundCampaign.name}`,
        );

        // Get the template for the default inbound campaign
        const [inboundTemplate] = await db
          .select()
          .from(campaignTemplates)
          .where(eq(campaignTemplates.id, inboundCampaign.templateId));

        if (inboundTemplate) {
          // Use the default inbound agent
          overrideAgentId = inboundTemplate.agentId;

          // Include campaign info in metadata
          metadata.campaignId = inboundCampaign.id;
          metadata.templateId = inboundTemplate.id;
          metadata.isDefaultInbound = true;
        }
      }

      // Basic variables for default inbound handling
      dynamicVariables = {
        organization_name: organization.name || "Our organization",
        inbound_call: true,
        patient_exists: patient ? true : false,
        patient_first_name: patient?.firstName || "Unknown",
        patient_last_name: patient?.lastName || "Unknown",
        patient_phone: patient?.primaryPhone || cleanPhone,
        first_name: patient?.firstName || "Unknown",
        last_name: patient?.lastName || "Unknown",
        phone: patient?.primaryPhone || cleanPhone,
      };
    }

    // Create inbound call record with better error handling
    try {
      // Ensure we have valid values for required fields
      const agent_id = payload.agent_id || "default-inbound-agent";

      // Create a new call record
      const [newCall] = await db
        .insert(calls)
        .values({
          orgId,
          fromNumber: payload.from_number,
          toNumber: payload.to_number,
          direction: "inbound",
          status: getStatus("call", "registered"),
          agentId: agent_id, // This will be overridden in the webhook response
          campaignId: metadata.campaignId || null,
          patientId: patientId || null,
          rowId: metadata.rowId || null,
          runId: metadata.runId || null,
          metadata: {
            webhook_received: true,
            webhook_time: new Date().toISOString(),
            ...metadata,
          },
        } as TCall)
        .returning();

      // Add the new call ID to metadata
      metadata.callId = newCall.id;

      // Generate context instructions if needed
      const context = {
        ...dynamicVariables,
        inbound_call: true,
      };

      // Generate context instructions using AI if available
      let instructions = "";
      try {
        const aiResponse = await generateContextInstructions(context);
        instructions = aiResponse.instructions || "";
      } catch (error) {
        console.error(
          "[WEBHOOK] Error generating context instructions:",
          error,
        );
        // Continue without instructions if generation fails
      }

      // Add instructions to the dynamic variables if available
      if (instructions) {
        dynamicVariables.instructions = instructions;
      }

      // Send real-time update
      try {
        await pusherServer.trigger(`org-${orgId}`, "inbound-call", {
          callId: newCall.id,
          patientId,
          fromNumber: payload.from_number,
          toNumber: payload.to_number,
          isReturnCall: !!mostRecentOutboundCall,
          campaignId: metadata.campaignId,
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
      console.log("[WEBHOOK] Returning agent override:", overrideAgentId);
      console.log("[WEBHOOK] Returning metadata:", metadata);

      return {
        status: "success",
        message: "Inbound call webhook processed successfully",
        error: null,
        call_inbound: {
          override_agent_id: overrideAgentId,
          dynamic_variables: dynamicVariables,
        },
        metadata: metadata,
      };
    } catch (error) {
      console.error("[WEBHOOK] Error processing inbound webhook:", error);

      // Return minimal context to avoid disrupting the call
      return {
        status: "partial_success",
        message: "Partial success",
        error: error instanceof Error ? error.message : String(error),
        call_inbound: {
          override_agent_id: null,
          dynamic_variables: {
            organization_name: organization?.name || "Our organization",
            error_occurred: true,
            patient_exists: patient ? true : false,
            patient_first_name: patient?.firstName || "Unknown",
            patient_last_name: patient?.lastName || "Unknown",
            first_name: patient?.firstName || "Unknown",
            last_name: patient?.lastName || "Unknown",
          },
        },
        metadata: {
          orgId,
          patientId,
          error: error instanceof Error ? error.message : String(error),
        },
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
      message: "Inbound call webhook processing failed",
      error: error instanceof Error ? error.message : String(error),
      call_inbound: {
        override_agent_id: null,
        dynamic_variables: {
          organization_name: "Our organization",
          error_occurred: true,
        },
      },
      metadata: {},
    };
  }
}

/**
 * Handler for Retell post-call webhook with improved error handling
 * Processes call results and updates database records
 */
// src/services/call/webhook.ts - Modified post-call webhook handler

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
      direction = payload.direction || "outbound",
      agent_id = payload.agent_id || "",
      metadata = payload.metadata || ({} as Record<string, any>),
      to_number: toNumber = payload.to_number || "",
      from_number: fromNumber = payload.from_number || "",
      call_status: callStatus = payload.call_status || "completed",
      recording_url: recordingUrl = payload.recording_url || null,
      disconnection_reason:
        disconnectionReason = payload.disconnection_reason || null,
      call_analysis = {
        transcript: payload.call_analysis?.transcript || "",
        in_voicemail:
          payload.call_status === "voicemail" ||
          payload.call_analysis?.in_voicemail,
        user_sentiment: payload.call_analysis?.user_sentiment || "",
        call_successful: payload.call_analysis?.call_successful || true,
        custom_analysis_data:
          payload.call_analysis?.custom_analysis_data ||
          ({} as Record<string, any>),
        call_completion_rating:
          payload.call_analysis?.call_completion_rating || "",
        agent_task_completion_rating:
          payload.call_analysis?.agent_task_completion_rating || "",
      },
    } = payload as RetellPostCallObjectRaw;

    if (!retellCallId) {
      console.error("[WEBHOOK] Missing call_id in post-call webhook payload");
      return { status: "error", error: "Missing call_id in webhook payload" };
    }

    console.log(
      `[WEBHOOK] Processing post-call webhook for call ${retellCallId}`,
    );

    // Check if this call exists in our database
    const [existingCall] = await db
      .select()
      .from(calls)
      .where(eq(calls.retellCallId, retellCallId));

    let callId: string;
    let rowId: string | null = null;
    let runId: string | null = null;
    let patientId: string | null = null;
    let originalCampaignId: string | null = campaignId;

    if (existingCall) {
      console.log(`[WEBHOOK] Found existing call record ${existingCall.id}`);

      callId = existingCall.id;
      rowId = existingCall.rowId;
      runId = existingCall.runId;
      patientId = existingCall.patientId;

      // If the call is already linked to a campaign, use that
      if (existingCall.campaignId) {
        originalCampaignId = existingCall.campaignId;
      }

      // For inbound calls, prioritize metadata from the existing call
      if (direction === "inbound" && existingCall.metadata) {
        // Extract important IDs from call metadata for inbound calls
        // These would have been set by our inbound webhook handler
        if (existingCall.metadata.rowId && !rowId) {
          rowId = existingCall.metadata.rowId as string;
          console.log(`[WEBHOOK] Using rowId from call metadata: ${rowId}`);
        }

        if (existingCall.metadata.runId && !runId) {
          runId = existingCall.metadata.runId as string;
          console.log(`[WEBHOOK] Using runId from call metadata: ${runId}`);
        }

        if (existingCall.metadata.campaignId && !originalCampaignId) {
          originalCampaignId = existingCall.metadata.campaignId as string;
          console.log(
            `[WEBHOOK] Using campaignId from call metadata: ${originalCampaignId}`,
          );
        }
      }
    } else {
      console.log(`[WEBHOOK] No existing call found, creating new record`);

      // For inbound calls, try to extract IDs from metadata provided by Retell
      // These would have been set in our inbound webhook response
      if (direction === "inbound" && metadata) {
        rowId = metadata.rowId || metadata.row_id || null;
        runId = metadata.runId || metadata.run_id || null;
        patientId = metadata.patientId || metadata.patient_id || null;

        if (metadata.campaignId || metadata.campaign_id) {
          originalCampaignId = metadata.campaignId || metadata.campaign_id;
        }

        console.log(
          `[WEBHOOK] Extracted from inbound metadata - rowId: ${rowId}, runId: ${runId}, campaignId: ${originalCampaignId}`,
        );
      }
      // For outbound calls, try to extract patient ID from metadata
      else if (direction === "outbound" && metadata) {
        patientId = metadata.patientId || metadata.patient_id || null;
      }

      // If no patient ID yet but we have a phone number, try to look up the patient
      if (!patientId && (direction === "inbound" ? fromNumber : toNumber)) {
        try {
          const patientPhone = direction === "inbound" ? fromNumber : toNumber;
          const cleanPhone = patientPhone;

          if (cleanPhone) {
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
            }
          }
        } catch (error) {
          console.error("[WEBHOOK] Error finding patient by phone:", error);
        }
      }

      // Create the call with proper metadata initialization
      const [newCall] = await db
        .insert(calls)
        .values({
          orgId,
          retellCallId,
          patientId,
          rowId,
          runId,
          toNumber,
          fromNumber,
          direction: direction as "inbound" | "outbound",
          status: getStatus("call", callStatus as RetellCallStatus),
          agentId: agent_id || "unknown",
          campaignId: originalCampaignId || null,
          metadata: {
            ...(metadata || {}),
            webhook_received: true,
            webhook_time: new Date().toISOString(),
          },
        } as TCall)
        .returning();

      callId = newCall.id;
      console.log(`[WEBHOOK] Created new call record ${callId}`);
    }

    // Fetch the complete call record again to make sure we have latest data
    const [call] = await db.select().from(calls).where(eq(calls.id, callId));

    if (!call) {
      throw new Error(`Call ${callId} not found after creation/lookup`);
    }

    // Re-assign these values from the latest call record
    rowId = call.rowId;
    runId = call.runId;
    patientId = call.patientId;
    originalCampaignId = call.campaignId;

    // Process campaign-specific configuration if available
    let campaignConfig = null;
    if (originalCampaignId) {
      console.log(
        `[WEBHOOK] Looking up campaign configuration for ${originalCampaignId}`,
      );

      try {
        const [campaign] = await db
          .select()
          .from(campaigns)
          .where(
            and(
              eq(campaigns.id, originalCampaignId),
              eq(campaigns.orgId, orgId),
            ),
          );

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
          status: getStatus("call", callStatus as RetellCallStatus),
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
            campaignId: originalCampaignId || call.metadata?.campaignId,
            insights: extractCallInsights({
              transcript: call_analysis?.transcript,
              analysis: processedAnalysis,
            }),
            updated_at: new Date().toISOString(),
          },
          updatedAt: new Date(),
        } as Partial<typeof calls.$inferInsert>)
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
            status: getStatus("row", callStatus as RetellCallStatus),
            error:
              callStatus === "failed"
                ? disconnectionReason || "Call failed"
                : null,
            analysis: processedAnalysis,
            metadata: {
              ...(call.metadata && typeof call.metadata === "object"
                ? call.metadata
                : {}),
              campaignId: originalCampaignId || null,
              callCompleted: callStatus === "completed",
              callInsights: extractCallInsights({
                transcript: call_analysis?.transcript,
                analysis: processedAnalysis,
              }),
              lastUpdated: new Date().toISOString(),
              // For inbound calls, mark it as a return call
              isReturnCall: direction === "inbound",
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
              inbound_returns: 0, // New field to track inbound returns
            };
          }

          // For inbound calls, increment inbound_returns counter
          if (direction === "inbound") {
            metadata.calls.inbound_returns =
              (metadata.calls.inbound_returns || 0) + 1;
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
          } else if (callStatus === "error") {
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

          // Only check for run completion for outbound calls
          // (inbound calls shouldn't affect run completion status)
          if (direction === "outbound") {
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

      // Include direction in the notification
      const callDirection = direction || "unknown";

      // Org-level notification
      await pusherServer.trigger(`org-${orgId}`, "call-updated", {
        callId: call.id,
        status: callStatus,
        patientId,
        runId,
        direction: callDirection,
        metadata: {
          campaignId: originalCampaignId || null,
        },
        analysis: processedAnalysis,
        insights,
      });

      // Campaign-specific notification
      if (originalCampaignId) {
        await pusherServer.trigger(
          `campaign-${originalCampaignId}`,
          "call-completed",
          {
            callId: call.id,
            status: callStatus,
            patientId,
            direction: callDirection,
            analysis: processedAnalysis,
            insights,
          },
        );
      }

      // Run-specific notification
      if (runId) {
        await pusherServer.trigger(`run-${runId}`, "call-completed", {
          callId: call.id,
          status: callStatus,
          rowId,
          direction: callDirection,
          metadata: {
            campaignId: originalCampaignId || null,
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
      direction,
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
      processedAnalysis.in_voicemail === true ||
      processedAnalysis.voicemail_detected === true;

    // Determine if follow-up is needed - check multiple possible conditions
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
