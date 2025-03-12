// src/lib/retell/post-call-webhook.ts

import { triggerEvent } from "@/lib/pusher-server";
import { db } from "@/server/db";
import {
  calls,
  campaigns,
  campaignTemplates,
  outreachEfforts,
  OutreachResolutionStatus,
  rows,
  runs,
} from "@/server/db/schema";
import { patientService } from "@/services/patients";
import { and, eq, or, sql } from "drizzle-orm";
import {
  extractCallInsights,
  getStatus,
  RetellCallStatus,
  RetellPostCallObjectRaw,
} from "./utils";

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
      call_status: callStatus = payload.call_status ||
        ("completed" as RetellCallStatus),
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

      // IMPROVED: Explicitly check and set voicemail flag
      const isVoicemail =
        callStatus === "voicemail" || call_analysis?.in_voicemail === true;

      if (isVoicemail) {
        processedAnalysis.voicemail_detected = true;
        processedAnalysis.left_voicemail = true; // Add additional flags for consistency
        processedAnalysis.in_voicemail = true;
        console.log(`[WEBHOOK] Voicemail detected for call ${retellCallId}`);
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
                // Add these flags for voicemail tracking
                wasVoicemail:
                  callStatus === "voicemail" ||
                  call_analysis?.in_voicemail === true ||
                  processedAnalysis.voicemail_detected === true,
                voicemailLeft:
                  callStatus === "voicemail" ||
                  call_analysis?.in_voicemail === true ||
                  processedAnalysis.voicemail_detected === true,
                // Existing flags for callbacks
                isReturnCall: direction === "inbound",
                isCallback: direction === "inbound" && call.outreachEffortId,
                wasCallback: direction === "inbound" && call.outreachEffortId,
                callbackTimestamp:
                  direction === "inbound" && call.outreachEffortId
                    ? new Date().toISOString()
                    : undefined,
                // Add debugging info
                webhookProcessed: true,
                webhookTimestamp: new Date().toISOString(),
                previousStatus: currentRow?.status || "unknown",
                voicemailTimestamp:
                  callStatus === "voicemail" ||
                  call_analysis?.in_voicemail === true
                    ? new Date().toISOString()
                    : undefined,
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

            // IMPROVED: More robust check for voicemail
            if (
              payload.call_status === "voicemail" ||
              call_analysis?.in_voicemail === true ||
              processedAnalysis.voicemail_detected === true ||
              processedAnalysis.left_voicemail === true ||
              processedAnalysis.voicemail_left === true
            ) {
              console.log(
                `[WEBHOOK] Incrementing voicemail count for run ${runId}`,
              );
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
          wasVoicemail:
            callStatus === "voicemail" ||
            call_analysis?.in_voicemail === true ||
            processedAnalysis.voicemail_detected === true,
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
        // Map the status to our internal status before sending the event
        const mappedStatus = getStatus("call", callStatus as RetellCallStatus);

        await triggerEvent(`run-${runId}`, "call-completed", {
          callId: call.id,
          status: mappedStatus, // Use the mapped status
          rowId,
          outreachEffortId: call.outreachEffortId || null,
          direction: callDirection as "inbound" | "outbound",
          metadata: {
            campaignId: originalCampaignId || null,
            wasVoicemail:
              callStatus === "voicemail" ||
              call_analysis?.in_voicemail === true ||
              processedAnalysis.voicemail_detected === true,
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
