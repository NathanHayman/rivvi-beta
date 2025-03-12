// This file contains utilities for debugging call status issues and monitoring call progress

// FILE: src/utils/debug-calls.ts
/**
 * Utility functions for debugging call and voicemail status issues
 */

import { db } from "@/server/db";
import { calls, rows, runs } from "@/server/db/schema";
import { and, count, eq, not, sql } from "drizzle-orm";

/**
 * Analyze a run for status inconsistencies
 * @param runId The ID of the run to analyze
 */
export async function analyzeRunStatus(runId: string) {
  try {
    // Get the run
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));

    if (!run) {
      return { error: "Run not found" };
    }

    // Get row counts by status
    const rowStatusCounts = await db
      .select({
        status: rows.status,
        count: count(),
      })
      .from(rows)
      .where(eq(rows.runId, runId))
      .groupBy(rows.status);

    // Get call counts by status
    const callStatusCounts = await db
      .select({
        status: calls.status,
        count: count(),
      })
      .from(calls)
      .where(eq(calls.runId, runId))
      .groupBy(calls.status);

    // Check for stuck calls (in-progress for too long)
    const stuckCalls = await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.runId, runId),
          eq(calls.status, "in-progress"),
          sql`${calls.startTime} < NOW() - INTERVAL '30 minutes'`,
        ),
      );

    // Check for mismatched statuses between rows and calls
    const mismatchedRows = await db
      .select({
        rowId: rows.id,
        rowStatus: rows.status,
        callId: calls.id,
        callStatus: calls.status,
      })
      .from(rows)
      .leftJoin(calls, eq(rows.id, calls.rowId))
      .where(
        and(
          eq(rows.runId, runId),
          not(eq(rows.status, "pending")), // Skip pending rows
          sql`(CASE 
            WHEN ${rows.status} = 'calling' AND ${calls.status} != 'in-progress' THEN true
            WHEN ${rows.status} = 'completed' AND ${calls.status} NOT IN ('completed', 'voicemail') THEN true
            WHEN ${rows.status} = 'failed' AND ${calls.status} != 'failed' THEN true
            ELSE false
          END)`,
        ),
      );

    // Check for voicemail detection issues
    const potentialVoicemails = await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.runId, runId),
          eq(calls.status, "completed"),
          sql`${calls.metadata}::jsonb ? 'analysis' AND 
              (${calls.metadata}::jsonb -> 'analysis')::jsonb ? 'voicemail_detected' AND
              (${calls.metadata}::jsonb -> 'analysis' -> 'voicemail_detected')::text = 'true'`,
        ),
      );

    // Get metrics from run metadata
    const metrics = run.metadata?.calls || ({} as any);

    return {
      run,
      rowStatusCounts,
      callStatusCounts,
      stuckCalls,
      mismatchedRows,
      potentialVoicemails,
      metrics,
      analysis: {
        stuckCallsCount: stuckCalls.length,
        mismatchedRowCount: mismatchedRows.length,
        voicemailsNotMarkedAsVoicemail: potentialVoicemails.length,
        rowCallCountMismatch:
          rowStatusCounts.reduce((sum, { count }) => sum + Number(count), 0) !==
          callStatusCounts.reduce((sum, { count }) => sum + Number(count), 0),
        metricsConsistency: {
          // Check if metadata metrics match the actual counts
          completedCallsMismatch:
            metrics.completed !==
            callStatusCounts.find((c) => c.status === "completed")?.count,
          failedCallsMismatch:
            metrics.failed !==
            callStatusCounts.find((c) => c.status === "failed")?.count,
          voicemailCallsMismatch:
            metrics.voicemail !==
            callStatusCounts.find((c) => c.status === "voicemail")?.count,
        },
      },
    };
  } catch (error) {
    console.error("Error analyzing run status:", error);
    return { error: error.message || "Unknown error" };
  }
}

/**
 * Fix status inconsistencies in a run
 */
export async function fixRunStatusIssues(
  runId: string,
  options = { fixStuckCalls: true, fixVoicemails: true, updateMetrics: true },
) {
  try {
    const analysis = await analyzeRunStatus(runId);

    if (analysis.error) {
      return { error: analysis.error };
    }

    const fixes = [];

    // Fix stuck calls
    if (options.fixStuckCalls && analysis.stuckCalls.length > 0) {
      for (const call of analysis.stuckCalls) {
        await db
          .update(calls)
          .set({
            status: "failed",
            error: "Call timed out (automatically resolved)",
            endTime: new Date(),
            updatedAt: new Date(),
          } as any)
          .where(eq(calls.id, call.id));

        if (call.rowId) {
          await db
            .update(rows)
            .set({
              status: "failed",
              error: "Call timed out (automatically resolved)",
              updatedAt: new Date(),
            } as any)
            .where(eq(rows.id, call.rowId));
        }

        fixes.push(`Fixed stuck call ${call.id}`);
      }
    }

    // Fix voicemails not marked as voicemail
    if (options.fixVoicemails && analysis.potentialVoicemails.length > 0) {
      for (const call of analysis.potentialVoicemails) {
        await db
          .update(calls)
          .set({
            status: "voicemail",
            updatedAt: new Date(),
          } as any)
          .where(eq(calls.id, call.id));

        fixes.push(`Fixed voicemail status for call ${call.id}`);
      }
    }

    // Recalculate run metrics
    if (options.updateMetrics) {
      // Count calls by status
      const callCounts = await db
        .select({
          completed: sql`COUNT(*) FILTER (WHERE ${calls.status} = 'completed')`,
          failed: sql`COUNT(*) FILTER (WHERE ${calls.status} = 'failed')`,
          voicemail: sql`COUNT(*) FILTER (WHERE ${calls.status} = 'voicemail')`,
          pending: sql`COUNT(*) FILTER (WHERE ${calls.status} = 'pending')`,
          inProgress: sql`COUNT(*) FILTER (WHERE ${calls.status} = 'in-progress')`,
          total: sql`COUNT(*)`,
        })
        .from(calls)
        .where(eq(calls.runId, runId));

      // Count connected calls (where patient was reached)
      const connectedCalls = await db
        .select({
          count: count(),
        })
        .from(calls)
        .where(
          and(
            eq(calls.runId, runId),
            sql`${calls.analysis}::jsonb ? 'patient_reached' AND (${calls.analysis}::jsonb -> 'patient_reached')::text = 'true'`,
          ),
        );

      // Get current run metadata
      const [run] = await db.select().from(runs).where(eq(runs.id, runId));

      if (run) {
        const metadata = { ...run.metadata } as any;

        // Update call metrics
        metadata.calls = {
          ...metadata.calls,
          total: Number(callCounts[0]?.total || 0),
          completed: Number(callCounts[0]?.completed || 0),
          failed: Number(callCounts[0]?.failed || 0),
          voicemail: Number(callCounts[0]?.voicemail || 0),
          pending: Number(callCounts[0]?.pending || 0),
          calling: Number(callCounts[0]?.inProgress || 0),
          connected: Number(connectedCalls[0]?.count || 0),
        };

        // Update run metrics
        await db
          .update(runs)
          .set({
            metadata,
            updatedAt: new Date(),
          } as any)
          .where(eq(runs.id, runId));

        fixes.push("Updated run metrics");
      }
    }

    return {
      success: true,
      fixes,
      fixedStuckCalls: analysis.stuckCalls.length,
      fixedVoicemails: analysis.potentialVoicemails.length,
      updatedMetrics: options.updateMetrics,
    };
  } catch (error) {
    console.error("Error fixing run status issues:", error);
    return { error: error.message || "Unknown error" };
  }
}

/**
 * Find calls with inconsistent status (missing voicemail status)
 */
export async function findMissingVoicemails(orgId: string, limit = 100) {
  try {
    const potentialVoicemails = await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.orgId, orgId),
          eq(calls.status, "completed"),
          sql`${calls.analysis}::jsonb ? 'voicemail_detected' AND (${calls.analysis}::jsonb -> 'voicemail_detected')::text = 'true'`,
        ),
      )
      .limit(limit);

    return {
      voicemailsMarkedAsCompleted: potentialVoicemails,
      count: potentialVoicemails.length,
    };
  } catch (error) {
    console.error("Error finding missing voicemails:", error);
    return { error: error.message || "Unknown error" };
  }
}

/**
 * Fix all voicemail status issues for an organization
 */
export async function fixAllVoicemailStatus(orgId: string) {
  try {
    const { voicemailsMarkedAsCompleted, error } = await findMissingVoicemails(
      orgId,
      10000,
    );

    if (error) {
      return { error };
    }

    const fixes = [];

    // Update all voicemail calls
    for (const call of voicemailsMarkedAsCompleted) {
      await db
        .update(calls)
        .set({
          status: "voicemail",
          updatedAt: new Date(),
        } as any)
        .where(eq(calls.id, call.id));

      fixes.push(`Fixed status for call ${call.id}`);

      // If call has a run, update run metrics
      if (call.runId) {
        const [run] = await db
          .select()
          .from(runs)
          .where(eq(runs.id, call.runId));

        if (run && run.metadata?.calls) {
          const metadata = { ...run.metadata };

          // Decrease completed count and increase voicemail count
          metadata.calls.completed = Math.max(
            0,
            (metadata.calls.completed || 0) - 1,
          );
          metadata.calls.voicemail = (metadata.calls.voicemail || 0) + 1;

          await db
            .update(runs)
            .set({
              metadata,
              updatedAt: new Date(),
            } as any)
            .where(eq(runs.id, call.runId));

          fixes.push(`Updated metrics for run ${call.runId}`);
        }
      }
    }

    return {
      success: true,
      fixedCount: voicemailsMarkedAsCompleted.length,
      fixes,
    };
  } catch (error) {
    console.error("Error fixing all voicemail status:", error);
    return { error: error.message || "Unknown error" };
  }
}

/**
 * Create a monitoring dashboard endpoint for checking call status issues
 */
export async function getCallStatusMonitoring(orgId: string) {
  try {
    // Get counts of various issues
    const stuckCalls = await db
      .select({
        count: count(),
      })
      .from(calls)
      .where(
        and(
          eq(calls.orgId, orgId),
          eq(calls.status, "in-progress"),
          sql`${calls.startTime} < NOW() - INTERVAL '30 minutes'`,
        ),
      );

    const potentialVoicemails = await db
      .select({
        count: count(),
      })
      .from(calls)
      .where(
        and(
          eq(calls.orgId, orgId),
          eq(calls.status, "completed"),
          sql`${calls.analysis}::jsonb ? 'voicemail_detected' AND (${calls.analysis}::jsonb -> 'voicemail_detected')::text = 'true'`,
        ),
      );

    const mismatchedRows = await db
      .select({
        count: count(),
      })
      .from(rows)
      .leftJoin(calls, eq(rows.id, calls.rowId))
      .where(
        and(
          eq(rows.orgId, orgId),
          not(eq(rows.status, "pending")),
          sql`(CASE 
            WHEN ${rows.status} = 'calling' AND ${calls.status} != 'in-progress' THEN true
            WHEN ${rows.status} = 'completed' AND ${calls.status} NOT IN ('completed', 'voicemail') THEN true
            WHEN ${rows.status} = 'failed' AND ${calls.status} != 'failed' THEN true
            ELSE false
          END)`,
        ),
      );

    // Get active runs with status issues
    const activeRuns = await db
      .select()
      .from(runs)
      .where(
        and(
          eq(runs.orgId, orgId),
          not(eq(runs.status, "completed")),
          not(eq(runs.status, "failed")),
        ),
      )
      .limit(10);

    const runAnalysis = await Promise.all(
      activeRuns.map(async (run) => {
        const analysis = await analyzeRunStatus(run.id);
        return {
          runId: run.id,
          name: run.name,
          status: run.status,
          issues: analysis.analysis,
        };
      }),
    );

    return {
      summary: {
        stuckCalls: Number(stuckCalls[0]?.count || 0),
        misclassifiedVoicemails: Number(potentialVoicemails[0]?.count || 0),
        mismatchedRows: Number(mismatchedRows[0]?.count || 0),
        activeRuns: activeRuns.length,
      },
      activeRuns: runAnalysis,
      recommendations: [
        stuckCalls[0]?.count > 0
          ? "Fix stuck calls to prevent resource waste"
          : null,
        potentialVoicemails[0]?.count > 0
          ? "Fix voicemail status to improve reporting accuracy"
          : null,
        mismatchedRows[0]?.count > 0
          ? "Fix mismatched row/call statuses for data consistency"
          : null,
      ].filter(Boolean),
    };
  } catch (error) {
    console.error("Error getting call status monitoring:", error);
    return { error: error.message || "Unknown error" };
  }
}

// Export API route handler to use these utilities
// You can add these to your API routes to enable debugging
export const callStatusActions = {
  analyzeRun: analyzeRunStatus,
  fixRunIssues: fixRunStatusIssues,
  findMissingVoicemails,
  fixAllVoicemailStatus,
  getMonitoring: getCallStatusMonitoring,
};
