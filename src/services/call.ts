// src/services/call-service.ts
import { pusherServer } from "@/lib/pusher-server";
import { retell } from "@/lib/retell-client";
import { db } from "@/server/db";
import {
  calls,
  campaigns,
  organizations,
  rows,
  runs,
} from "@/server/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, or, sql } from "drizzle-orm";

/**
 * Dispatch a call using Retell AI
 */
export async function dispatchCall(params: {
  toNumber: string;
  fromNumber: string;
  agentId: string;
  variables: Record<string, unknown>;
  metadata: {
    runId?: string;
    rowId?: string;
    orgId: string;
    campaignId?: string;
    patientId?: string;
  };
}) {
  const { toNumber, fromNumber, agentId, variables, metadata } = params;

  try {
    // Create the call in Retell
    const retellCall = await retell.call.createPhoneCall({
      to_number: toNumber,
      from_number: fromNumber,
      override_agent_id: agentId,
      retell_llm_dynamic_variables: variables,
      metadata,
    });

    if (!retellCall.call_id) {
      throw new Error("No call ID returned from Retell API");
    }

    // Create call record in database
    const [call] = await db
      .insert(calls)
      .values({
        id: createId(),
        orgId: metadata.orgId,
        runId: metadata.runId,
        rowId: metadata.rowId,
        patientId: metadata.patientId,
        agentId,
        direction: "outbound",
        status: "pending",
        retellCallId: retellCall.call_id,
        toNumber,
        fromNumber,
        metadata,
      })
      .returning();

    return { call, retellCallId: retellCall.call_id };
  } catch (error) {
    console.error("Error dispatching call:", error);
    throw error;
  }
}

/**
 * Process calls for a run in batches
 */
export async function processRunCalls(runId: string) {
  try {
    // Get run details
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));

    if (!run || run.status !== "running") {
      return { success: false, message: "Run is not in running state" };
    }

    // Get organization for concurrency limit
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, run.orgId));

    if (!organization) {
      return { success: false, message: "Organization not found" };
    }

    // Get campaign for agent ID
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, run.campaignId));

    if (!campaign) {
      return { success: false, message: "Campaign not found" };
    }

    // Check concurrency limits
    const concurrencyLimit = organization.concurrentCallLimit || 20;

    // Count active calls
    const [{ value: activeCalls }] = (await db
      .select({
        value: sql`COUNT(*)`.mapWith(Number),
      })
      .from(calls)
      .where(and(eq(calls.runId, runId), eq(calls.status, "in-progress")))) as [
      { value: number },
    ];

    const availableSlots = concurrencyLimit - Number(activeCalls);

    if (availableSlots <= 0) {
      return {
        success: true,
        message: "At concurrency limit, no calls dispatched",
      };
    }

    // Get next batch of pending rows
    const pendingRows = await db
      .select()
      .from(rows)
      .where(and(eq(rows.runId, runId), eq(rows.status, "pending")))
      .orderBy(rows.sortIndex)
      .limit(availableSlots);

    if (pendingRows.length === 0) {
      // Check if run is complete (no more pending or calling rows)
      const [{ value: remainingRows }] = (await db
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

      if (Number(remainingRows) === 0) {
        // Update run to completed
        await completeRun(runId);
        return {
          success: true,
          message: "Run completed, no more calls to make",
        };
      }

      return { success: true, message: "No pending rows found" };
    }

    // Process each row in batch
    const dispatchedCalls = [];
    const failedCalls = [];

    for (const row of pendingRows) {
      try {
        // Mark row as calling
        await db
          .update(rows)
          .set({ status: "calling", updatedAt: new Date() })
          .where(eq(rows.id, row.id));

        // Get phone number from row variables
        const phone = row.variables.phone || row.variables.primaryPhone;

        if (!phone) {
          throw new Error("No phone number found in row variables");
        }

        // Create call in Retell
        const result = await dispatchCall({
          toNumber: String(phone),
          fromNumber: organization.phone || "",
          agentId: campaign.agentId,
          variables: {
            ...row.variables,
            custom_prompt: run.customPrompt || undefined,
          },
          metadata: {
            runId,
            rowId: row.id,
            orgId: run.orgId,
            campaignId: campaign.id,
            patientId: row.patientId || undefined,
          },
        });

        // Update run metrics
        await incrementRunMetric(runId, "calls.calling");

        // Send real-time update
        await pusherServer.trigger(`run-${runId}`, "call-started", {
          rowId: row.id,
          callId: result.retellCallId,
        });

        dispatchedCalls.push(result);
      } catch (error) {
        console.error(`Error dispatching call for row ${row.id}:`, error);

        // Mark row as failed
        await db
          .update(rows)
          .set({
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(rows.id, row.id));

        // Update run metrics
        await incrementRunMetric(runId, "calls.failed");

        failedCalls.push({
          rowId: row.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Small delay between calls
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return {
      success: true,
      dispatchedCalls,
      failedCalls,
      message: `Dispatched ${dispatchedCalls.length} calls, ${failedCalls.length} failed`,
    };
  } catch (error) {
    console.error(`Error processing run ${runId}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Mark a run as completed
 */
export async function completeRun(runId: string) {
  try {
    // Get run details
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));

    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const endTime = new Date().toISOString();

    // Calculate run duration if start time is available
    let duration: number | undefined;
    if (run.metadata?.run?.startTime) {
      const startTime = new Date(run.metadata.run.startTime).getTime();
      duration = Math.floor((Date.now() - startTime) / 1000); // Duration in seconds
    }

    // Update run status to completed
    const updatedMetadata = {
      ...run.metadata,
      run: {
        ...run.metadata?.run,
        endTime,
        duration,
      },
    };

    await db
      .update(runs)
      .set({
        status: "completed",
        metadata: updatedMetadata as any,
        updatedAt: new Date(),
      })
      .where(eq(runs.id, runId));

    // Send real-time update
    await pusherServer.trigger(`org-${run.orgId}`, "run-updated", {
      runId,
      status: "completed",
      metadata: updatedMetadata,
    });

    return { success: true };
  } catch (error) {
    console.error(`Error completing run ${runId}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Increment a metric in run metadata
 */
export async function incrementRunMetric(runId: string, metricPath: string) {
  try {
    // Get run
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));

    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    // Parse path (e.g., 'calls.completed')
    const parts = metricPath.split(".") as string[];

    // Create a deep copy of metadata
    const metadata = JSON.parse(JSON.stringify(run.metadata || {})) as Record<
      string,
      any
    >;

    // Navigate to the correct part of the object
    let current = metadata;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part && !current[part]) {
        current[part] = {};
      }
      current = current[part as string];
    }

    // Increment the metric
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      current[lastPart] = (current[lastPart] || 0) + 1;
    }

    // Update run metadata
    await db
      .update(runs)
      .set({
        metadata: metadata as any,
        updatedAt: new Date(),
      })
      .where(eq(runs.id, runId));

    // Send real-time update
    await pusherServer.trigger(`run-${runId}`, "metrics-updated", {
      runId,
      metrics: metadata,
    });

    return { success: true, updatedMetadata: metadata };
  } catch (error) {
    console.error(`Error incrementing run metric ${runId}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get call details including transcript
 */
export async function getCallDetails(callId: string) {
  try {
    // Get call from database
    const [call] = await db.select().from(calls).where(eq(calls.id, callId));

    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    // If transcript is already stored, return it
    if (call.transcript) {
      return { call };
    }

    // Otherwise, try to fetch from Retell
    try {
      const retellCall = await retell.call.retrieve(call.retellCallId);

      if (retellCall.transcript) {
        // Store transcript for future requests
        await db
          .update(calls)
          .set({ transcript: retellCall.transcript })
          .where(eq(calls.id, callId));

        return {
          call: {
            ...call,
            transcript: retellCall.transcript,
          },
        };
      }

      return { call, message: "Transcript not available yet" };
    } catch (error) {
      console.error(`Error fetching call details from Retell:`, error);
      return { call, error: "Failed to fetch transcript from Retell" };
    }
  } catch (error) {
    console.error(`Error getting call details for ${callId}:`, error);
    throw error;
  }
}
