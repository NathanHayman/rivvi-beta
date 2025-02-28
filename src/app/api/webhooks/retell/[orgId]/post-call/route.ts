// src/app/api/webhooks/retell/post-call/route.ts
import { pusherServer } from "@/lib/pusher-server";
import { db } from "@/server/db";
import { calls, rows, runs } from "@/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Parse the webhook payload
    const data = await request.json();

    // Validate the webhook has the necessary data
    if (!data.call || !data.call.call_id) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }

    // Extract metadata from the call
    const metadata = data.call.metadata || {};
    const { runId, rowId, orgId } = metadata;

    // If this is not a run-related call, we might handle it differently
    if (!runId || !rowId) {
      console.log("Non-run call webhook received:", data.call.call_id);
      // Handle standalone calls here if needed
      return NextResponse.json({ success: true });
    }

    // Find the call in our database
    const [existingCall] = await db
      .select()
      .from(calls)
      .where(eq(calls.retellCallId, data.call.call_id));

    if (!existingCall) {
      console.error("Call not found in database:", data.call.call_id);
      return NextResponse.json(
        { error: "Call not found in database" },
        { status: 404 },
      );
    }

    // Determine call status
    let callStatus: string = "completed";
    if (data.call.status === "failed") {
      callStatus = "failed";
    } else if (data.call.metrics?.voicemail_detected) {
      callStatus = "voicemail";
    } else if (data.call.metrics?.no_answer) {
      callStatus = "no-answer";
    }

    // Extract relevant data from the webhook
    const callData = {
      status: callStatus,
      recordingUrl: data.call.recording_url,
      transcript: data.call.transcript,
      analysis: data.call.analysis || {},
      startTime: data.call.start_time
        ? new Date(data.call.start_time)
        : undefined,
      endTime: data.call.end_time ? new Date(data.call.end_time) : undefined,
      duration: data.call.duration,
      updatedAt: new Date(),
    };

    // Update the call record
    await db
      .update(calls)
      .set(callData as any)
      .where(eq(calls.retellCallId, data.call.call_id));

    // Extract post-call data if available
    let postCallData = {};
    if (data.call.analysis) {
      // Attempt to extract standard fields from analysis
      // This would be customized based on your AI agent's output format
      if (typeof data.call.analysis === "object") {
        // Example: Extract fields like patient_reached, appointment_confirmed, etc.
        postCallData = {
          ...data.call.analysis,
        };
      }
    }

    // Update the row status and post-call data
    await db
      .update(rows)
      .set({
        status: "completed",
        postCallData,
        updatedAt: new Date(),
      })
      .where(eq(rows.id, rowId));

    // Fetch the run to update metrics
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));

    if (run) {
      // Update run metrics
      const metadata = { ...run.metadata } as any;

      // Increment completed calls
      if (!metadata.calls) metadata.calls = {};
      metadata.calls.completed = (metadata.calls.completed || 0) + 1;

      // Decrement calling calls
      metadata.calls.calling = Math.max(0, (metadata.calls.calling || 0) - 1);

      // Track specific outcomes
      if (callStatus === "voicemail") {
        metadata.calls.voicemail = (metadata.calls.voicemail || 0) + 1;
      } else if (callStatus === "failed") {
        metadata.calls.failed = (metadata.calls.failed || 0) + 1;
      } else if (data.call.analysis?.patient_reached === true) {
        metadata.calls.connected = (metadata.calls.connected || 0) + 1;

        // Track conversions (customize based on your campaign metrics)
        if (
          data.call.analysis?.appointment_confirmed === true ||
          data.call.analysis?.appointment_confirmed === "true" ||
          data.call.analysis?.appointmentConfirmed === true ||
          data.call.analysis?.appointmentConfirmed === "true"
        ) {
          metadata.calls.converted = (metadata.calls.converted || 0) + 1;
        }
      }

      // Update the run metadata
      await db
        .update(runs)
        .set({
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      // Check if run is complete
      const [pendingResult] = await db
        .select({
          pendingCount: sql<number>`count(*)`,
        })
        .from(rows)
        .where(and(eq(rows.runId, runId), eq(rows.status, "pending")));

      const pendingCount = pendingResult?.pendingCount ?? 0;

      const [callingResult] = await db
        .select({
          callingCount: sql<number>`count(*)`,
        })
        .from(rows)
        .where(and(eq(rows.runId, runId), eq(rows.status, "calling")));

      const callingCount = callingResult?.callingCount ?? 0;

      // If no more pending or calling rows, and run is still running, mark as completed
      if (
        Number(pendingCount) === 0 &&
        Number(callingCount) === 0 &&
        run.status === "running"
      ) {
        const endTime = new Date().toISOString();
        let duration: number | undefined;

        // Calculate run duration if start time is available
        if (run.metadata?.run?.startTime) {
          const startTime = new Date(run.metadata.run.startTime).getTime();
          duration = Math.floor((Date.now() - startTime) / 1000); // Duration in seconds
        }

        // Update run metadata with completion info
        const updatedMetadata = {
          ...metadata,
          run: {
            ...metadata.run,
            endTime,
            duration,
          },
        };

        // Mark run as completed
        await db
          .update(runs)
          .set({
            status: "completed",
            metadata: updatedMetadata,
            updatedAt: new Date(),
          })
          .where(eq(runs.id, runId));

        // Send real-time update for run completion
        await pusherServer.trigger(`org-${orgId}`, "run-updated", {
          runId,
          status: "completed",
          metadata: updatedMetadata,
        });
      }
    }

    // Send real-time update for call completion
    await pusherServer.trigger(`run-${runId}`, "call-completed", {
      rowId,
      callId: data.call.call_id,
      status: callStatus,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing Retell webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
