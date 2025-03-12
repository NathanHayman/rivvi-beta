// src/server/api/webhooks/retell-handler.ts

import { triggerEvent } from "@/lib/pusher-server";
import { db } from "@/server/db";
import {
  calls,
  campaigns,
  campaignTemplates,
  organizations,
  outreachEfforts,
  OutreachResolutionStatus,
  rows,
  runs,
} from "@/server/db/schema";
import { patientService } from "@/services/patients";
import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { isError } from "../service-result";

// Types for Retell webhook payloads
export type RetellCallStatus =
  | "registered"
  | "ongoing"
  | "ended"
  | "error"
  | "voicemail";
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

export type RetellInboundWebhookPayload = {
  from_number: string;
  to_number: string;
  agent_id: string;
  [key: string]: any;
};

export type RetellInboundWebhookResponse = {
  status: "success" | "error";
  message?: string;
  error?: string;
  call_inbound: {
    override_agent_id: string | null;
    dynamic_variables: Record<string, any>;
    metadata: Record<string, any>;
  };
};

export type RetellPostCallObjectRaw = {
  call_id?: string;
  direction?: "inbound" | "outbound";
  agent_id?: string;
  metadata?: Record<string, any>;
  to_number?: string;
  from_number?: string;
  call_status?: string;
  recording_url?: string | null;
  disconnection_reason?: string | null;
  transcript?: string;
  duration_ms?: number;
  start_timestamp?: string;
  end_timestamp?: string;
  call_analysis?: {
    transcript?: string;
    call_summary?: string | null;
    in_voicemail?: boolean;
    user_sentiment?: string;
    call_successful?: boolean;
    custom_analysis_data?: Record<string, any>;
    call_completion_rating?: string;
    agent_task_completion_rating?: string;
  };
  [key: string]: any;
};

// Find the type definition for the object and add outreachEffortId
type CallLogEntry = {
  callId: string;
  patientId?: string;
  fromNumber: string;
  toNumber: string;
  retellCallId: string;
  isReturnCall?: boolean;
  campaignId?: string;
  outreachEffortId?: string; // Add this field
  hotSwapPerformed?: boolean;
  time: string;
};

/**
 * Helper function to map Retell call status to our internal status
 */
function getStatus(
  type: "call" | "row",
  status: RetellCallStatus,
): CallStatus | RowStatus {
  console.log(`[STATUS CONVERSION] Converting ${status} to ${type} status`);

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
      case "voicemail":
        return "voicemail";
      default:
        console.log(
          `[WARNING] Unknown call status: ${status}, defaulting to pending`,
        );
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
      case "voicemail":
        // For row status, treat voicemail as completed
        return "completed";
      default:
        console.log(
          `[WARNING] Unknown row status: ${status}, defaulting to pending`,
        );
        return "pending";
    }
  }
}

/**
 * Ensure values are always strings for Retell dynamic variables
 */
function ensureStringValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Handle inbound webhook from Retell with agent hot-swapping
 * This processes incoming calls, identifies patients, and provides context
 */
export async function handleInboundWebhook(
  orgId: string,
  payload: RetellInboundWebhookPayload,
): Promise<RetellInboundWebhookResponse> {
  console.log(
    `[INBOUND WEBHOOK] Inbound call received for org ${orgId}:`,
    JSON.stringify(payload),
  );

  try {
    // Initialize variables at the beginning to fix linter errors
    let overrideAgentId = null;
    let dynamicVariables: Record<string, any> = {};
    const metadata: Record<string, any> = {
      orgId,
      patientId: null,
      isInboundCall: true,
    };

    // Validate required fields with better error handling
    if (!payload.from_number) {
      console.error(
        `[INBOUND WEBHOOK] Missing from_number in inbound webhook payload`,
      );
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
          metadata: {},
        },
      };
    }

    if (!payload.to_number) {
      console.warn(
        `[INBOUND WEBHOOK] Missing to_number in inbound webhook payload, using fallback`,
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
      console.error(`[INBOUND WEBHOOK] Organization ${orgId} not found`);
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
          metadata: {},
        },
      };
    }

    // Find patient by phone number
    const cleanPhone = payload.from_number;
    console.log(`[INBOUND WEBHOOK] Looking up patient by phone: ${cleanPhone}`);

    // First try using the patient service
    const patient = await patientService.findByPhone(cleanPhone, orgId);

    // Create a minimal patient record if not found
    let patientId: string | null = patient?.id || null;
    if (!patient) {
      try {
        console.log(
          `[INBOUND WEBHOOK] No existing patient found, creating minimal record`,
        );
        // Create a basic patient record with today's date as a placeholder DOB
        const today = new Date().toISOString().split("T")[0]; // Format as YYYY-MM-DD

        const patientResult = await patientService.create({
          firstName: "Unknown",
          lastName: "Caller",
          dob: today || "",
          primaryPhone: cleanPhone,
          orgId,
        });

        if (isError(patientResult)) {
          console.error(
            "[INBOUND WEBHOOK] Error creating patient:",
            patientResult.error,
          );
          patientId = null;
        } else {
          patientId = patientResult.data.id;
          console.log(
            `[INBOUND WEBHOOK] Created new patient with ID: ${patientId}`,
          );
        }
      } catch (error) {
        console.error("[INBOUND WEBHOOK] Error creating patient:", error);
        // Continue with a null patientId if patient creation fails
        patientId = null;
      }
    } else {
      console.log(
        `[INBOUND WEBHOOK] Found existing patient: ${patient.firstName} ${patient.lastName} (ID: ${patient.id})`,
      );
    }

    // Update metadata with patient ID
    metadata.patientId = patientId;

    // Find open outreach efforts for this patient
    let outreachEffort = null;
    let rowData = null;
    let campaignData = null;
    let templateData = null;
    let runData = null;
    let mostRecentOutboundCall = null;
    let shouldHotSwapAgent = false;

    if (patientId) {
      try {
        // Find open outreach efforts for the patient, prioritizing those with status 'open' or 'voicemail'
        const openOutreachEfforts = await db
          .select({
            effort: outreachEfforts,
            campaign: campaigns,
            row: rows,
            run: runs,
          })
          .from(outreachEfforts)
          .leftJoin(campaigns, eq(outreachEfforts.campaignId, campaigns.id))
          .leftJoin(rows, eq(outreachEfforts.rowId, rows.id))
          .leftJoin(runs, eq(outreachEfforts.runId, runs.id))
          .where(
            and(
              eq(outreachEfforts.patientId, patientId),
              eq(outreachEfforts.orgId, orgId),
              or(
                eq(outreachEfforts.resolutionStatus, "open"),
                eq(outreachEfforts.resolutionStatus, "voicemail"),
                eq(outreachEfforts.resolutionStatus, "follow_up"),
              ),
            ),
          )
          .orderBy(desc(outreachEfforts.createdAt));

        if (openOutreachEfforts.length > 0) {
          outreachEffort = openOutreachEfforts[0].effort;
          rowData = openOutreachEfforts[0].row;
          campaignData = openOutreachEfforts[0].campaign;
          runData = openOutreachEfforts[0].run;
          shouldHotSwapAgent = true; // Flag to indicate we should hot-swap the agent

          // Get the most recent outbound call for this outreach effort
          if (outreachEffort.lastCallId) {
            const [call] = await db
              .select()
              .from(calls)
              .where(eq(calls.id, outreachEffort.lastCallId));

            mostRecentOutboundCall = call;
          }

          // Get the campaign template to access the agent ID
          if (campaignData && campaignData.templateId) {
            const [template] = await db
              .select()
              .from(campaignTemplates)
              .where(eq(campaignTemplates.id, campaignData.templateId));

            templateData = template;

            // Use the template's agent ID for hot-swapping
            if (template && template.agentId) {
              overrideAgentId = template.agentId;
              console.log(
                `[INBOUND WEBHOOK] Found agent ID ${overrideAgentId} for hot-swapping`,
              );
            }
          }

          console.log(
            `[INBOUND WEBHOOK] Found open outreach effort (${outreachEffort.id}) for campaign "${campaignData?.name || "unknown"}" with resolution status ${outreachEffort.resolutionStatus}`,
          );

          // Update metadata for the call to link it to this outreach effort
          metadata.outreachEffortId = outreachEffort.id;
          metadata.campaignId = campaignData?.id;
          metadata.runId = runData?.id;
          metadata.rowId = rowData?.id;
          metadata.isReturnCall = true;
          metadata.previousCallId = outreachEffort.lastCallId;
          metadata.hotSwapPerformed = true;

          // Set dynamic variables for the agent
          if (patient) {
            dynamicVariables = {
              organization_name: organization.name || "Our organization",
              inbound_call: true,
              is_return_call: true,
              patient_exists: true,
              patient_id: patient.id,
              patient_first_name: patient.firstName || "Unknown",
              patient_last_name: patient.lastName || "Unknown",
              patient_phone: patient.primaryPhone || cleanPhone,
              first_name: patient.firstName || "Unknown",
              last_name: patient.lastName || "Unknown",
              phone: patient.primaryPhone || cleanPhone,
              previous_call_status: outreachEffort.resolutionStatus,
              campaign_name: campaignData?.name || "Unknown Campaign",
              is_minor: rowData?.variables?.isMinor || false,
            };

            // Add variables from the outreach effort or row
            if (outreachEffort.variables) {
              Object.entries(outreachEffort.variables).forEach(
                ([key, value]) => {
                  dynamicVariables[key] = ensureStringValue(value);
                },
              );
            }

            if (rowData?.variables) {
              Object.entries(rowData.variables).forEach(([key, value]) => {
                dynamicVariables[key] = ensureStringValue(value);
              });
            }
          }
        } else {
          console.log(
            `[INBOUND WEBHOOK] No open outreach efforts found for patient, will find organization's default inbound agent`,
          );

          // Use helper function to find the default inbound agent
          const defaultAgent = await findDefaultInboundAgent(orgId);
          overrideAgentId = defaultAgent.agentId;

          // Update metadata with campaign info if available
          if (defaultAgent.campaignId) {
            metadata.campaignId = defaultAgent.campaignId;
            metadata.usingDefaultInboundCampaign = true;
          }

          // We'll still set the patient context if available
          if (patient) {
            // Update the dynamic variables that will be used later
            dynamicVariables = {
              organization_name: organization.name || "Our organization",
              inbound_call: true,
              is_return_call: false,
              patient_exists: true,
              patient_id: patient.id,
              patient_first_name: patient.firstName || "Unknown",
              patient_last_name: patient.lastName || "Unknown",
              patient_phone: patient.primaryPhone || cleanPhone,
              first_name: patient.firstName || "Unknown",
              last_name: patient.lastName || "Unknown",
              phone: patient.primaryPhone || cleanPhone,
              campaign_name:
                defaultAgent.campaignName || "Inbound Call Service",
            };
          }
        }
      } catch (error) {
        console.error(
          "[INBOUND WEBHOOK] Error handling callback or default agent selection:",
          error,
        );

        // Fallback to default agent if there's an error
        overrideAgentId = "default-inbound-agent";
      }
    } else {
      // No patient ID available, find the default inbound agent
      console.log(
        `[INBOUND WEBHOOK] No patient found, finding default inbound agent`,
      );

      // Use helper function to find the default inbound agent
      const defaultAgent = await findDefaultInboundAgent(orgId);
      overrideAgentId = defaultAgent.agentId;

      // Update metadata with campaign info if available
      if (defaultAgent.campaignId) {
        metadata.campaignId = defaultAgent.campaignId;
        metadata.usingDefaultInboundCampaign = true;
      }
    }

    // Create inbound call record with better error handling
    try {
      // Ensure we have valid values for required fields
      const agent_id =
        payload.agent_id || overrideAgentId || "default-inbound-agent";

      // Create a new call record
      const [newCall] = await db
        .insert(calls)
        .values({
          orgId,
          fromNumber: payload.from_number,
          toNumber: payload.to_number,
          direction: "inbound",
          retellCallId: createId(),
          status: "in-progress",
          agentId: agent_id, // This will be overridden in the webhook response
          campaignId: metadata.campaignId || null,
          patientId: patientId || null,
          rowId: metadata.rowId || null,
          runId: metadata.runId || null,
          outreachEffortId: metadata.outreachEffortId || null,
          relatedOutboundCallId: metadata.previousCallId || null,
          metadata: {
            webhook_received: true,
            webhook_time: new Date().toISOString(),
            ...metadata,
          },
        } as any)
        .returning();

      // Add the new call ID to metadata
      metadata.callId = newCall.id;

      // If this relates to an outreach effort, update it
      if (metadata.outreachEffortId) {
        try {
          await db
            .update(outreachEfforts)
            .set({
              lastCallId: newCall.id,
              callbackCount: sql`${outreachEfforts.callbackCount} + 1`,
              resolutionStatus: "callback", // Mark as callback initially, post-call handler will update further
              updatedAt: new Date(),
            } as any)
            .where(eq(outreachEfforts.id, metadata.outreachEffortId));

          console.log(
            `[INBOUND WEBHOOK] Updated outreach effort ${metadata.outreachEffortId} with callback data`,
          );
        } catch (updateError) {
          console.error(
            `[INBOUND WEBHOOK] Error updating outreach effort with callback data:`,
            updateError,
          );
          // Continue processing even if update fails
        }
      }

      // If this is a return call and we have row data, update the row to indicate a callback
      if (metadata.isReturnCall && rowData) {
        try {
          // Get the original status from the outreach effort (for UI display)
          const originalStatus = outreachEffort?.resolutionStatus || "unknown";

          // Get effective time of the last outbound call for context
          const lastOutboundTime = mostRecentOutboundCall?.startTime
            ? new Date(mostRecentOutboundCall.startTime).toISOString()
            : new Date().toISOString();

          await db
            .update(rows)
            .set({
              metadata: {
                ...rowData.metadata,
                returnCall: true,
                returnCallId: newCall.id,
                returnCallTime: new Date().toISOString(),
                isCallback: true, // Add a clear flag to indicate this was a callback
                wasCallback: true, // Alternative naming for UI filtering
                callbackReason: originalStatus, // Track the original reason for the callback
                callbackAfterStatus: originalStatus, // Clearer naming
                previousOutboundTime: lastOutboundTime,
                outreachEffortId: outreachEffort?.id,
              },
              status: "callback", // Update status to reflect callback
              updatedAt: new Date(),
            } as any)
            .where(eq(rows.id, rowData.id));

          console.log(
            `[INBOUND WEBHOOK] Updated row ${rowData.id} with return call data (callback after ${originalStatus}) and set status to 'callback'`,
          );

          // Update run statistics for inbound calls if we have a runId
          if (metadata.runId) {
            // Fetch current run data
            const [run] = await db
              .select()
              .from(runs)
              .where(eq(runs.id, metadata.runId));

            if (run) {
              // Create a deep copy of metadata
              const updatedMetadata = JSON.parse(
                JSON.stringify(run.metadata || {}),
              ) as Record<string, any>;

              // Initialize callback metrics if they don't exist
              if (!updatedMetadata.callbacks) {
                updatedMetadata.callbacks = {
                  count: 0,
                  ids: [],
                };
              }

              // Update callback metrics
              updatedMetadata.callbacks.count++;
              updatedMetadata.callbacks.ids.push(newCall.id);
              updatedMetadata.lastCallbackTime = new Date().toISOString();

              try {
                await db
                  .update(runs)
                  .set({
                    metadata: updatedMetadata,
                    updatedAt: new Date(),
                  } as any)
                  .where(eq(runs.id, metadata.runId));

                console.log(
                  `[INBOUND WEBHOOK] Updated run ${metadata.runId} with callback statistics`,
                );
              } catch (runUpdateError) {
                console.error(
                  `[INBOUND WEBHOOK] Error updating run with callback statistics:`,
                  runUpdateError,
                );
              }
            }
          }
        } catch (error) {
          console.error(
            `[INBOUND WEBHOOK] Error updating row with return call data:`,
            error,
          );
        }
      }

      // Return the success response with hot-swapping information
      console.log(
        `[INBOUND WEBHOOK] Inbound call webhook processed successfully`,
      );
      console.log(
        `[INBOUND WEBHOOK] Returning agent override: ${overrideAgentId}`,
      );
      console.log(`[INBOUND WEBHOOK] Returning metadata:`, metadata);

      // Emit event for inbound call (for real-time UI updates)
      try {
        await triggerEvent(`org-${orgId}`, "inbound-call", {
          callId: newCall.id,
          patientId,
          fromNumber: payload.from_number,
          toNumber: payload.to_number || "unknown",
          retellCallId: newCall.retellCallId || "",
          isReturnCall: !!metadata.isReturnCall,
          campaignId: metadata.campaignId,
          outreachEffortId: metadata.outreachEffortId,
          hotSwapPerformed: metadata.hotSwapPerformed || false,
          time: new Date().toISOString(),
        } as CallLogEntry);
        console.log(`[INBOUND WEBHOOK] Sent event for inbound call`);
      } catch (error) {
        console.error(`[INBOUND WEBHOOK] Error sending pusher event:`, error);
      }

      // Convert dynamic variables to strings for Retell
      const stringifiedVariables: Record<string, string> = {};
      Object.entries(dynamicVariables).forEach(([key, value]) => {
        stringifiedVariables[key] = ensureStringValue(value);
      });

      // Convert metadata to strings for Retell
      const stringifiedMetadata: Record<string, string> = {};
      Object.entries(metadata).forEach(([key, value]) => {
        stringifiedMetadata[key] =
          typeof value === "object" ? JSON.stringify(value) : String(value);
      });

      return {
        status: "success",
        message: "Inbound call processed",
        call_inbound: {
          override_agent_id: overrideAgentId,
          dynamic_variables: stringifiedVariables,
          metadata: stringifiedMetadata,
        },
      };
    } catch (error) {
      console.error(`[INBOUND WEBHOOK] Error creating inbound call:`, error);
    }

    // Fallback response
    return {
      status: "error",
      message: "Error processing inbound call",
      error: "Internal server error",
      call_inbound: {
        override_agent_id: null,
        dynamic_variables: {
          error_occurred: true,
          error_message: "Error processing call",
        },
        metadata: {},
      },
    };
  } catch (error) {
    console.error("[INBOUND WEBHOOK] Error processing inbound webhook:", error);

    // Return a fallback error response
    return {
      status: "error",
      message: "Error processing webhook",
      error: String(error),
      call_inbound: {
        override_agent_id: null,
        dynamic_variables: {
          error_occurred: true,
          error_message: "Error processing call",
        },
        metadata: {},
      },
    };
  }
}

/**
 * Handler for Retell post-call webhook
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

  // Add detailed logging of the call data
  console.log(
    `[WEBHOOK] Call details - ID: ${payload.call_id}, Status: ${payload.call_status}`,
  );
  if (payload.metadata) {
    console.log(
      `[WEBHOOK] Call metadata:`,
      JSON.stringify(payload.metadata, null, 2),
    );
    if (payload.metadata.rowId) {
      console.log(`[WEBHOOK] Associated row ID: ${payload.metadata.rowId}`);
    }
    if (payload.metadata.runId) {
      console.log(`[WEBHOOK] Associated run ID: ${payload.metadata.runId}`);
    }
    if (payload.metadata.outreachEffortId) {
      console.log(
        `[WEBHOOK] Associated outreach effort ID: ${payload.metadata.outreachEffortId}`,
      );
    }
  }
  console.log(
    `[WEBHOOK] Call direction: ${payload.direction}, Duration: ${payload.duration_ms}ms`,
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
        transcript: payload?.transcript || "",
        call_summary: payload?.call_analysis?.call_summary || null,
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
      duration_ms: callDuration = payload.duration_ms || 0,
      start_timestamp: startTime = payload.start_timestamp || null,
      end_timestamp: endTime = payload.end_timestamp || null,
    } = payload;

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
      .where(
        eq(
          direction === "inbound" ? calls.id : calls.retellCallId,
          direction === "inbound" ? metadata.callId : retellCallId,
        ),
      );

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
            const patient = await patientService.findByPhone(cleanPhone, orgId);

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
        } as any)
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

      // If call summary is available, add it to the analysis
      if (call_analysis?.call_summary) {
        processedAnalysis.summary = call_analysis.call_summary;
      }

      // If user sentiment is available, add it to the analysis
      if (call_analysis?.user_sentiment) {
        processedAnalysis.user_sentiment = call_analysis.user_sentiment;
      }

      // If call successful is available, add it to the analysis
      if (call_analysis?.call_successful !== undefined) {
        processedAnalysis.call_successful = call_analysis.call_successful;
      }

      // If call completion rating is available, add it to the analysis
      if (call_analysis?.call_completion_rating) {
        processedAnalysis.call_completion_rating =
          call_analysis.call_completion_rating;
      }

      // Campaign-specific processing
      if (campaignConfig?.analysisConfig) {
        // Try to extract custom fields based on the campaign's analysis config
        try {
          // Process standard fields first
          const standardFields =
            campaignConfig.analysisConfig?.standard?.fields || [];

          standardFields.forEach((field) => {
            if (
              field &&
              field.key &&
              call_analysis?.custom_analysis_data?.[field.key] !== undefined
            ) {
              processedAnalysis[field.key] =
                call_analysis.custom_analysis_data[field.key];
            }
          });

          // Then campaign-specific fields
          const campaignFields =
            campaignConfig.analysisConfig?.campaign?.fields || [];

          campaignFields.forEach((field) => {
            if (
              field &&
              field.key &&
              call_analysis?.custom_analysis_data?.[field.key] !== undefined
            ) {
              processedAnalysis[field.key] =
                call_analysis.custom_analysis_data[field.key];

              // Mark main KPI if applicable
              if (field.isMainKPI) {
                processedAnalysis.main_kpi_field = field.key;
                processedAnalysis.main_kpi_value =
                  call_analysis.custom_analysis_data[field.key];
              }
            }
          });
        } catch (analysisError) {
          console.error(
            "[WEBHOOK] Error processing campaign-specific analysis:",
            analysisError,
          );
        }
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
          transcript: payload?.transcript || call.transcript,
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
              transcript: payload?.transcript || call.transcript,
              analysis: processedAnalysis,
            }),
            updated_at: new Date().toISOString(),
          },
          updatedAt: new Date(),
        } as any)
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
        // Get the current row status before updating
        const [currentRow] = await db
          .select()
          .from(rows)
          .where(eq(rows.id, rowId));

        if (currentRow) {
          console.log(
            `[WEBHOOK] Current row status: ${currentRow.status}, updating to: ${getStatus("row", callStatus as RetellCallStatus)}`,
          );
        }

        // Robust update with better error handling and diagnostics
        try {
          // Determine the appropriate row status
          let rowStatus;

          // If this is an inbound callback, set status to "callback" regardless of call outcome
          if (direction === "inbound" && call.outreachEffortId) {
            rowStatus = "callback";
            console.log(
              `[WEBHOOK] Setting row status to 'callback' for inbound callback`,
            );
          } else {
            // For non-callback calls, use the standard status mapping
            rowStatus = getStatus("row", callStatus as RetellCallStatus);
          }

          // Perform update with explicit WHERE clause to ensure we're updating the correct row
          const result = await db
            .update(rows)
            .set({
              status: rowStatus,
              error:
                callStatus === "failed"
                  ? disconnectionReason || "Call failed"
                  : null,
              analysis: processedAnalysis,
              patientId: patientId,
              metadata: {
                ...(currentRow?.metadata &&
                typeof currentRow.metadata === "object"
                  ? currentRow.metadata
                  : {}),
                campaignId: originalCampaignId || null,
                callCompleted: callStatus === "completed",
                callInsights: extractCallInsights({
                  transcript: payload?.transcript || call.transcript,
                  analysis: processedAnalysis,
                }),
                lastUpdated: new Date().toISOString(),
                // Add clear flags for callbacks to improve UI differentiation
                isReturnCall: direction === "inbound",
                isCallback: direction === "inbound" && call.outreachEffortId, // Clear flag indicating this was a callback
                wasCallback: direction === "inbound" && call.outreachEffortId, // Alternative naming for UI filtering
                callbackTimestamp:
                  direction === "inbound" && call.outreachEffortId
                    ? new Date().toISOString()
                    : undefined,
                // Add debugging info
                webhookProcessed: true,
                webhookTimestamp: new Date().toISOString(),
                previousStatus: currentRow?.status || "unknown",
              },
              updatedAt: new Date(),
            } as any) // Use type assertion to avoid linter errors
            .where(eq(rows.id, rowId));

          console.log(
            `[WEBHOOK] Row ${rowId} updated with call results ${callStatus}`,
          );

          // Now, handle outreach effort tracking
          if (direction === "outbound" && patientId) {
            // For outbound calls, create or update an outreach effort
            const outreachEffortId = call.outreachEffortId;

            // Determine resolution status based on processed analysis
            let resolutionStatus: OutreachResolutionStatus = "open";

            // Extract patientReached flag from processed analysis
            const patientReached =
              processedAnalysis?.patient_reached === true ||
              processedAnalysis?.patientReached === true;

            console.log("processedAnalysis", processedAnalysis);

            if (processedAnalysis) {
              console.log("process analysis exists");
              if (
                processedAnalysis?.appointment_confirmed === true ||
                processedAnalysis?.medication_confirmed === true ||
                processedAnalysis?.issue_resolved === true ||
                processedAnalysis?.agreed_to_schedule === true ||
                processedAnalysis?.agreed_to_reschedule === true ||
                processedAnalysis?.transferred === true ||
                processedAnalysis?.callback_requested === false
                // ||
                // patientReached // Also mark as resolved if patient was reached
              ) {
                resolutionStatus = "resolved";
              } else {
                resolutionStatus = "open"; // Default: issue not yet resolved
              }
            } else {
              resolutionStatus = "open";
            }

            // If we have an existing outreach effort, update it
            if (outreachEffortId) {
              await db
                .update(outreachEfforts)
                .set({
                  lastCallId: callId,
                  resolutionStatus: resolutionStatus,
                  // Don't increment callCount since it was already set to 1 during dispatch
                  // callCount: sql`${outreachEfforts.callCount} + 1`,
                  updatedAt: new Date(),
                  resolvedAt:
                    resolutionStatus === "resolved" ? new Date() : null,
                } as any)
                .where(eq(outreachEfforts.id, outreachEffortId));

              console.log(
                `[WEBHOOK] Updated outreach effort ${outreachEffortId} with status ${resolutionStatus}`,
              );
            } else {
              // Create a new outreach effort
              // Note: This is a fallback case that should rarely happen now that
              // we create outreach efforts at call dispatch time in the run processor.
              // This handles legacy calls or edge cases where outreach creation failed during dispatch.
              console.log(
                `[WEBHOOK] No outreach effort found for call ${callId}, creating one as fallback`,
              );

              const [newOutreachEffort] = await db
                .insert(outreachEfforts)
                .values({
                  orgId,
                  patientId,
                  campaignId: originalCampaignId,
                  runId,
                  rowId,
                  originalCallId: callId,
                  lastCallId: callId,
                  resolutionStatus: resolutionStatus,
                  direction: "outbound",
                  agentId: agent_id,
                  variables: currentRow?.variables || {},
                  metadata: {
                    firstCallTime: new Date().toISOString(),
                    lastCallStatus: callStatus,
                    analysis: processedAnalysis,
                  },
                } as any)
                .returning();

              // Update the call with the new outreach effort ID
              await db
                .update(calls)
                .set({
                  outreachEffortId: newOutreachEffort.id,
                } as any)
                .where(eq(calls.id, callId));

              console.log(
                `[WEBHOOK] Created new outreach effort ${newOutreachEffort.id} with status ${resolutionStatus}`,
              );
            }
          } else if (direction === "inbound" && call.outreachEffortId) {
            // For inbound calls, update the associated outreach effort if there is one
            // For inbound callbacks, ALWAYS set to resolved since the patient initiated contact
            // This addresses the issue where callbacks weren't being marked as resolved

            // Get the current outreach effort to save its original status
            const [currentOutreachEffort] = await db
              .select()
              .from(outreachEfforts)
              .where(eq(outreachEfforts.id, call.outreachEffortId));

            // Original status before this update - useful for tracking
            const originalStatus =
              currentOutreachEffort?.resolutionStatus || "unknown";

            await db
              .update(outreachEfforts)
              .set({
                lastCallId: callId,
                resolutionStatus: "resolved", // Always resolve when it's a callback, regardless of call outcome
                updatedAt: new Date(),
                resolvedAt: new Date(), // Always set resolved time for callbacks
                callbackCount: sql`${outreachEfforts.callbackCount} + 1`, // Increment callback count
                metadata: {
                  ...(currentOutreachEffort?.metadata || {}),
                  lastCallbackTime: new Date().toISOString(),
                  lastCallbackStatus: callStatus,
                  lastCallbackAnalysis: processedAnalysis,
                  wasCallback: true, // Flag to indicate this was resolved via callback
                  appointmentConfirmed:
                    processedAnalysis?.appointment_confirmed === true,
                  issueResolved: processedAnalysis?.issue_resolved === true,
                  medicationConfirmed:
                    processedAnalysis?.medication_confirmed === true,
                  // Add a clear callback resolution reason for UI differentiation
                  callbackResolved: true,
                  callbackResolvedAt: new Date().toISOString(),
                  originalStatus: originalStatus, // Save original status for reference
                },
              } as any)
              .where(eq(outreachEfforts.id, call.outreachEffortId));

            console.log(
              `[WEBHOOK] Updated outreach effort ${call.outreachEffortId} from status "${originalStatus}" to resolved (inbound callback)`,
            );
          }
        } catch (error) {
          console.error(
            "[WEBHOOK] Error updating row or outreach effort:",
            error,
          );
        }
      } catch (error) {
        console.error("[WEBHOOK] Error updating row:", error);
      }
    }

    // If the call is not associated with a row but has a patient, we still need to track outreach
    else if (!rowId && patientId && direction === "outbound") {
      // Check if there's already an outreach effort for this call
      if (call.outreachEffortId) {
        // Update the existing outreach effort
        try {
          // Determine resolution status based on call outcome
          const patientReached =
            processedAnalysis?.patient_reached === true ||
            processedAnalysis?.patientReached === true;

          const voicemailLeft =
            processedAnalysis?.voicemail_left === true ||
            processedAnalysis?.left_voicemail === true ||
            call_analysis?.in_voicemail === true;

          let resolutionStatus: string;
          if (callStatus === "failed" || callStatus === "no-answer") {
            resolutionStatus = "no_contact";
          } else if (voicemailLeft) {
            resolutionStatus = "voicemail";
          } else if (patientReached) {
            // If patient was reached, mark as resolved directly
            resolutionStatus = "resolved";
          } else {
            resolutionStatus = "open";
          }

          await db
            .update(outreachEfforts)
            .set({
              lastCallId: callId,
              resolutionStatus: resolutionStatus,
              // Don't increment callCount since it was already set to 1 during dispatch
              // callCount: sql`${outreachEfforts.callCount} + 1`,
              updatedAt: new Date(),
              resolvedAt: resolutionStatus === "resolved" ? new Date() : null,
              metadata: {
                lastCallTime: new Date().toISOString(),
                lastCallStatus: callStatus,
                analysis: processedAnalysis,
              },
            } as any)
            .where(eq(outreachEfforts.id, call.outreachEffortId));

          console.log(
            `[WEBHOOK] Updated standalone outreach effort ${call.outreachEffortId} with status ${resolutionStatus}`,
          );
        } catch (error) {
          console.error(
            "[WEBHOOK] Error updating standalone outreach effort:",
            error,
          );
        }
      } else {
        // Create an outreach effort record even without a row (e.g., for manual calls)
        // Note: This is a fallback case that should rarely happen now that
        // we create outreach efforts at call dispatch time in the run processor.
        // This handles legacy calls or manually dialed calls without a row.
        console.log(
          `[WEBHOOK] No outreach effort found for standalone call ${callId}, creating one`,
        );

        try {
          // Determine resolution status based on call outcome
          const patientReached =
            processedAnalysis?.patient_reached === true ||
            processedAnalysis?.patientReached === true;

          const voicemailLeft =
            processedAnalysis?.voicemail_left === true ||
            processedAnalysis?.left_voicemail === true ||
            call_analysis?.in_voicemail === true;

          let resolutionStatus: string;
          if (callStatus === "failed" || callStatus === "no-answer") {
            resolutionStatus = "no_contact";
          } else if (voicemailLeft) {
            resolutionStatus = "voicemail";
          } else if (patientReached) {
            // If patient was reached, mark as resolved directly
            resolutionStatus = "resolved";
          } else {
            resolutionStatus = "open";
          }

          // Create a new outreach effort
          const [newOutreachEffort] = await db
            .insert(outreachEfforts)
            .values({
              orgId,
              patientId,
              campaignId: originalCampaignId,
              runId,
              originalCallId: callId,
              lastCallId: callId,
              resolutionStatus: resolutionStatus,
              direction: "outbound",
              agentId: agent_id,
              metadata: {
                firstCallTime: new Date().toISOString(),
                lastCallStatus: callStatus,
                analysis: processedAnalysis,
              },
            } as any)
            .returning();

          // Update the call with the new outreach effort ID
          await db
            .update(calls)
            .set({
              outreachEffortId: newOutreachEffort.id,
            } as any)
            .where(eq(calls.id, callId));

          console.log(
            `[WEBHOOK] Created new standalone outreach effort ${newOutreachEffort.id} with status ${resolutionStatus}`,
          );
        } catch (error) {
          console.error(
            "[WEBHOOK] Error creating standalone outreach effort:",
            error,
          );
        }
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

            // Check the main KPI field if available
            if (
              processedAnalysis.main_kpi_field &&
              processedAnalysis.main_kpi_value
            ) {
              const value = processedAnalysis.main_kpi_value;
              if (
                value === true ||
                value === "true" ||
                value === "yes" ||
                value === 1
              ) {
                conversionValue = true;
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
            } as any)
            .where(eq(runs.id, runId));

          console.log(`[WEBHOOK] Updated run ${runId} metrics`);

          // Only check for run completion for outbound calls
          // (inbound calls shouldn't affect run completion status)
          if (direction === "outbound") {
            // Check if run is complete (all rows processed)
            const [{ value: pendingRows }] = await db
              .select({ value: sql`COUNT(*)` })
              .from(rows)
              .where(
                and(
                  eq(rows.runId, runId),
                  or(eq(rows.status, "pending"), eq(rows.status, "calling")),
                ),
              );

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
                } as any)
                .where(eq(runs.id, runId));

              // Send real-time update for run completion
              await triggerEvent(`org-${orgId}`, "run-updated", {
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
          await triggerEvent(`run-${runId}`, "metrics-updated", {
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
        transcript: payload?.transcript || call.transcript,
        analysis: processedAnalysis,
      });

      // Include direction in the notification
      const callDirection = direction || "unknown";

      // Org-level notification
      await triggerEvent(`org-${orgId}`, "call-updated", {
        callId: call.id,
        status: callStatus,
        patientId,
        runId,
        outreachEffortId: call.outreachEffortId || null,
        direction: callDirection as "inbound" | "outbound",
        metadata: {
          campaignId: originalCampaignId || null,
        },
        analysis: processedAnalysis,
        insights,
      });

      // Campaign-specific notification
      if (originalCampaignId) {
        await triggerEvent(`campaign-${originalCampaignId}`, "call-completed", {
          callId: call.id,
          status: callStatus,
          patientId,
          outreachEffortId: call.outreachEffortId || null,
          direction: callDirection as "inbound" | "outbound",
          analysis: processedAnalysis,
          insights,
        });
      }

      // Run-specific notification
      if (runId) {
        await triggerEvent(`run-${runId}`, "call-completed", {
          callId: call.id,
          status: callStatus,
          rowId,
          outreachEffortId: call.outreachEffortId || null,
          direction: callDirection as "inbound" | "outbound",
          metadata: {
            campaignId: originalCampaignId || null,
          },
          analysis: processedAnalysis,
          insights,
        });
      }

      console.log(`[WEBHOOK] Sent all real-time updates for call ${call.id}`);
    } catch (error) {
      console.error("[WEBHOOK] Error sending notifications:", error);
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
        transcript: payload?.transcript || call.transcript,
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
}

// Add a helper function to find the default inbound agent for an organization
async function findDefaultInboundAgent(orgId: string): Promise<{
  agentId: string | null;
  campaignId: string | null;
  campaignName: string | null;
}> {
  try {
    // Look for campaigns with direction "inbound" for this organization
    const inboundCampaigns = await db
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
        and(eq(campaigns.orgId, orgId), eq(campaigns.direction, "inbound")),
      )
      .orderBy(desc(campaigns.updatedAt));

    if (inboundCampaigns.length > 0) {
      // Use the most recently updated inbound campaign
      const inboundCampaign = inboundCampaigns[0];

      if (inboundCampaign.template && inboundCampaign.template.agentId) {
        console.log(
          `[INBOUND WEBHOOK] Found organization's default inbound agent (${inboundCampaign.template.agentId}) from campaign "${inboundCampaign.campaign.name}"`,
        );

        return {
          agentId: inboundCampaign.template.agentId,
          campaignId: inboundCampaign.campaign.id,
          campaignName: inboundCampaign.campaign.name,
        };
      } else {
        console.warn(
          `[INBOUND WEBHOOK] Inbound campaign found but has no agent ID, using fallback`,
        );
      }
    } else {
      console.warn(
        `[INBOUND WEBHOOK] No inbound campaigns found for organization ${orgId}, using fallback agent`,
      );
    }
  } catch (error) {
    console.error(
      `[INBOUND WEBHOOK] Error finding default inbound agent:`,
      error,
    );
  }

  // Return fallback if no inbound campaign found or error occurred
  return {
    agentId: "default-inbound-agent", // Fallback agent ID
    campaignId: null,
    campaignName: null,
  };
}
