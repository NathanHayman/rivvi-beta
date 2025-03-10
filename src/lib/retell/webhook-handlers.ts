// src/lib/retell/webhook-handlers.ts
import { triggerEvent } from "@/lib/pusher-server";
import { db } from "@/server/db";
import {
  calls,
  campaigns,
  organizationPatients,
  patients,
  rows,
  runs,
} from "@/server/db/schema";
import {
  RetellInboundWebhookPayload,
  RetellPostCallObjectRaw,
} from "@/types/retell";
import { and, eq, or, sql } from "drizzle-orm";

/**
 * Handle inbound webhook from Retell
 */
export async function handleInboundWebhook(
  orgId: string,
  data: RetellInboundWebhookPayload,
) {
  try {
    console.log(`Processing inbound webhook for org ${orgId}`);

    // Extract call data
    const { from_number, to_number, agent_id } = data;

    // Look for a matching patient by phone number
    const [patient] = await db
      .select()
      .from(patients)
      .innerJoin(
        organizationPatients,
        and(
          eq(patients.id, organizationPatients.patientId),
          eq(organizationPatients.orgId, orgId),
        ),
      )
      .where(
        or(
          eq(patients.primaryPhone, from_number),
          eq(patients.secondaryPhone, from_number),
        ),
      )
      .limit(1);

    // Find the organization's default inbound campaign
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.orgId, orgId),
          eq(campaigns.direction, "inbound"),
          eq(campaigns.isDefaultInbound, true),
          eq(campaigns.isActive, true),
        ),
      )
      .limit(1);

    // Build dynamic variables to pass to the agent
    const dynamicVariables = {
      // Default variables
      call_direction: "inbound",
      patient_id: patient?.patient.id || "",
      first_name: patient?.patient.firstName || "",
      last_name: patient?.patient.lastName || "",

      // Flags
      is_known_patient: !!patient,
      error_occurred: false,
    };

    // Build metadata for the call
    const metadata = {
      orgId,
      patientId: patient?.patient.id,
      campaignId: campaign?.id,
      direction: "inbound",
      fromNumber: from_number,
      toNumber: to_number,
    };

    // If patient found and has had previous calls, include additional info
    if (patient?.patient.id) {
      // Get recent calls for this patient
      const recentCalls = await db
        .select()
        .from(calls)
        .where(
          and(eq(calls.patientId, patient.patient.id), eq(calls.orgId, orgId)),
        )
        .orderBy(desc(calls.createdAt))
        .limit(5);

      if (recentCalls.length > 0) {
        dynamicVariables.has_previous_calls = "true";
        dynamicVariables.last_call_date = new Date(
          recentCalls[0].createdAt,
        ).toISOString();
      }
    }

    // Create a call record in our database
    await db.insert(calls).values({
      orgId,
      direction: "inbound",
      status: "in-progress",
      patientId: patient?.patient.id,
      campaignId: campaign?.id,
      agentId: agent_id,
      toNumber: to_number,
      fromNumber: from_number,
      metadata,
    });

    // Trigger real-time event for inbound call
    await triggerEvent(`org-${orgId}`, "inbound-call", {
      retellCallId: data.retell_call_id || "unknown",
      patientId: patient?.id,
      fromNumber: from_number,
      toNumber: to_number,
      time: new Date().toISOString(),
    });

    // Prepare response
    return {
      call_inbound: {
        override_agent_id: campaign?.agentId || data.agent_id,
        dynamic_variables: dynamicVariables,
        metadata,
      },
    };
  } catch (error) {
    console.error("Error processing inbound webhook:", error);

    // Return error response with default agent
    return {
      call_inbound: {
        override_agent_id: data.agent_id,
        dynamic_variables: {
          error_occurred: true,
          error_message: "Error processing request",
        },
        metadata: {},
      },
    };
  }
}

/**
 * Handle post-call webhook from Retell
 */
export async function handlePostCallWebhook(
  orgId: string,
  campaignId: string | null,
  callData: RetellPostCallObjectRaw,
) {
  try {
    console.log(`Processing post-call webhook for org ${orgId}`);

    // Find the associated call in our database
    const [call] = await db
      .select()
      .from(calls)
      .where(
        and(eq(calls.retellCallId, callData.call_id), eq(calls.orgId, orgId)),
      )
      .limit(1);

    if (!call) {
      // Create a new call record if not found
      console.log(`Call ${callData.call_id} not found, creating new record`);

      await db.insert(calls).values({
        orgId,
        campaignId,
        retellCallId: callData.call_id,
        direction: callData.direction as "inbound" | "outbound",
        status: "completed",
        toNumber: callData.to_number,
        fromNumber: callData.from_number,
        agentId: callData.agent_id,
        startTime: new Date(callData.start_timestamp),
        endTime: new Date(callData.end_timestamp),
        duration: Math.floor(callData.duration_ms / 1000),
        transcript: callData.transcript,
        recordingUrl: callData.recording_url,
        analysis: callData.call_analysis.custom_analysis_data,
        metadata: callData.metadata,
      });

      console.log(`Created new call record for ${callData.call_id}`);
      return { success: true, message: "Created new call record" };
    }

    // Update the existing call record
    const callId = call.id;

    await db
      .update(calls)
      .set({
        status: "completed",
        startTime: new Date(callData.start_timestamp),
        endTime: new Date(callData.end_timestamp),
        duration: Math.floor(callData.duration_ms / 1000),
        transcript: callData.transcript,
        recordingUrl: callData.recording_url,
        analysis: callData.call_analysis.custom_analysis_data,
        updatedAt: new Date(),
      })
      .where(eq(calls.id, callId));

    console.log(`Updated call record for ${callId}`);

    // If this call is part of a run, update the row status
    if (call.rowId) {
      await db
        .update(rows)
        .set({
          status: "completed",
          analysis: callData.call_analysis.custom_analysis_data,
          updatedAt: new Date(),
        })
        .where(eq(rows.id, call.rowId));

      console.log(`Updated row ${call.rowId} to completed`);

      // Trigger call completed event for the run
      if (call.runId) {
        await triggerEvent(`run-${call.runId}`, "call-completed", {
          rowId: call.rowId,
          callId: callId,
          status: "completed",
          analysis: callData.call_analysis.custom_analysis_data,
        });

        // Update run metrics
        await updateRunMetrics(call.runId);
      }
    }

    // Trigger org-level call updated event
    await triggerEvent(`org-${orgId}`, "call-updated", {
      callId,
      status: "completed",
      patientId: call.patientId,
      runId: call.runId,
      analysis: callData.call_analysis.custom_analysis_data,
    });

    return { success: true, message: "Processed call data successfully" };
  } catch (error) {
    console.error("Error handling post-call webhook:", error);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Update run metrics based on call results
 */
async function updateRunMetrics(runId: string) {
  try {
    // Get current call stats for the run
    const [stats] = await db
      .select({
        total: count(),
        completed: sql`SUM(CASE WHEN ${calls.status} = 'completed' THEN 1 ELSE 0 END)`,
        failed: sql`SUM(CASE WHEN ${calls.status} = 'failed' THEN 1 ELSE 0 END)`,
        voicemail: sql`SUM(CASE WHEN ${calls.status} = 'voicemail' THEN 1 ELSE 0 END)`,
        inProgress: sql`SUM(CASE WHEN ${calls.status} = 'in-progress' THEN 1 ELSE 0 END)`,
        pending: sql`SUM(CASE WHEN ${calls.status} = 'pending' THEN 1 ELSE 0 END)`,
      })
      .from(calls)
      .where(eq(calls.runId, runId));

    // Get the run record
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));

    if (!run) return;

    // Update the run metadata with current stats
    const updatedMetadata = {
      ...run.metadata,
      calls: {
        total: Number(stats.total) || 0,
        completed: Number(stats.completed) || 0,
        failed: Number(stats.failed) || 0,
        calling: Number(stats.inProgress) || 0,
        pending: Number(stats.pending) || 0,
        voicemail: Number(stats.voicemail) || 0,
        ...run.metadata?.calls,
      },
    };

    await db
      .update(runs)
      .set({
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(runs.id, runId));

    // Trigger metrics updated event
    await triggerEvent(`run-${runId}`, "metrics-updated", {
      runId,
      metrics: updatedMetadata.calls,
    });
  } catch (error) {
    console.error(`Error updating run metrics for ${runId}:`, error);
  }
}
