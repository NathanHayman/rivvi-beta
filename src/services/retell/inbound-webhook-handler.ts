// src/lib/retell/inbound-webhook.ts

import { triggerEvent } from "@/lib/pusher-server";
import { isError } from "@/lib/service-result";
import { db } from "@/server/db";
import {
  calls,
  campaigns,
  campaignTemplates,
  organizations,
  outreachEfforts,
  rows,
  runs,
} from "@/server/db/schema";
import { patientService } from "@/services/patients";
import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  CallLogEntry,
  ensureStringValue,
  RetellInboundWebhookPayload,
  RetellInboundWebhookResponse,
} from "./utils";

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
 * Helper function to find the default inbound agent for an organization
 */
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
