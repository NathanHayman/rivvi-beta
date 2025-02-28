// src/lib/call-processor.ts
import {
  calls,
  campaigns,
  organizations,
  rows,
  runs,
} from "@/server/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, or, sql } from "drizzle-orm";
import { pusherServer } from "./pusher-server";
import { createPhoneCall } from "./retell-client";

type DatabaseClient = typeof import("@/server/db").db;

export class CallProcessor {
  private db: DatabaseClient;
  private processingRuns: Set<string> = new Set();

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  /**
   * Process a run's calls in batches
   */
  async processRun(runId: string, orgId: string) {
    // Check if this run is already being processed
    if (this.processingRuns.has(runId)) {
      console.log(`Run ${runId} is already being processed`);
      return;
    }

    // Add run to processing set
    this.processingRuns.add(runId);

    let processing = true;
    let currentRun: any = null;

    try {
      while (processing) {
        // Get run details
        const [run] = await this.db
          .select()
          .from(runs)
          .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

        currentRun = run;

        if (!run || run.status !== "running") {
          processing = false;
          continue;
        }

        // Get organization for concurrency limit
        const [organization] = await this.db
          .select()
          .from(organizations)
          .where(eq(organizations.id, orgId));

        if (!organization) {
          throw new Error(`Organization ${orgId} not found`);
        }

        // Get campaign for agent ID
        const [campaign] = await this.db
          .select()
          .from(campaigns)
          .where(eq(campaigns.id, run.campaignId));

        if (!campaign) {
          throw new Error(`Campaign ${run.campaignId} not found`);
        }

        // Check concurrency limits
        const concurrencyLimit = organization.concurrentCallLimit || 20;

        // Count active calls
        const [{ value: activeCalls }] = (await this.db
          .select({
            value: sql`COUNT(*)`.mapWith(Number),
          })
          .from(calls)
          .where(
            and(eq(calls.runId, runId), eq(calls.status, "in-progress")),
          )) as [{ value: number }];

        const availableSlots = concurrencyLimit - Number(activeCalls);

        if (availableSlots <= 0) {
          // No available slots, wait before checking again
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        // Get next batch of pending rows
        const pendingRows = await this.db
          .select()
          .from(rows)
          .where(and(eq(rows.runId, runId), eq(rows.status, "pending")))
          .orderBy(rows.sortIndex)
          .limit(availableSlots);

        if (pendingRows.length === 0) {
          // Check if run is complete (no more pending or calling rows)
          const [{ value: remainingRows }] = (await this.db
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
            await this.completeRun(runId);
          }

          processing = false;
          continue;
        }

        // Process each row in batch
        for (const row of pendingRows) {
          try {
            // Mark row as calling
            await this.db
              .update(rows)
              .set({ status: "calling", updatedAt: new Date() })
              .where(eq(rows.id, row.id));

            // Get phone number from row variables
            const phone = row.variables.phone || row.variables.primaryPhone;

            if (!phone) {
              throw new Error("No phone number found in row variables");
            }

            // Create call in Retell
            const retellCall = await createPhoneCall({
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
                orgId,
                campaignId: campaign.id,
              },
            });

            if (!retellCall.call_id) {
              throw new Error("No call ID returned from Retell");
            }

            // Update row with call ID
            await this.db
              .update(rows)
              .set({ retellCallId: retellCall.call_id, updatedAt: new Date() })
              .where(eq(rows.id, row.id));

            // Create call record
            await this.db.insert(calls).values({
              id: createId(),
              orgId,
              runId,
              rowId: row.id,
              patientId: row.patientId,
              agentId: campaign.agentId,
              direction: "outbound",
              status: "pending",
              retellCallId: retellCall.call_id,
              toNumber: String(phone),
              fromNumber: organization.phone || "",
              metadata: {
                variables: row.variables,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            // Update run metrics
            await this.incrementMetric(runId, "calls.calling");

            // Send real-time update
            await pusherServer.trigger(`run-${runId}`, "call-started", {
              rowId: row.id,
              callId: retellCall.call_id,
            });
          } catch (error) {
            console.error(`Error dispatching call for row ${row.id}:`, error);

            // Mark row as failed
            await this.db
              .update(rows)
              .set({
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
                updatedAt: new Date(),
              })
              .where(eq(rows.id, row.id));

            // Update run metrics
            await this.incrementMetric(runId, "calls.failed");
          }

          // Small delay between calls
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Wait before processing next batch (avoid API rate limits)
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`Error processing run ${runId}:`, error);

      // Mark run as failed
      await this.db
        .update(runs)
        .set({
          status: "failed",
          metadata: {
            ...(currentRun?.metadata || {}),
            run: {
              ...(currentRun?.metadata?.run || {}),
              error: error instanceof Error ? error.message : String(error),
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      // Send real-time update
      await pusherServer.trigger(`org-${orgId}`, "run-updated", {
        runId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Remove run from processing set
      this.processingRuns.delete(runId);
    }
  }

  /**
   * Mark a run as completed
   */
  async completeRun(runId: string) {
    // Get run details
    const [run] = await this.db.select().from(runs).where(eq(runs.id, runId));

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

    await this.db
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
      metadata: updatedMetadata as any,
    });
  }

  /**
   * Increment a metric in run metadata
   */
  async incrementMetric(runId: string, metricPath: string) {
    // Get run
    const [run] = await this.db.select().from(runs).where(eq(runs.id, runId));

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
    let current: Record<string, any> = metadata;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i] as string;
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part] as Record<string, any>;
    }

    // Increment the metric
    const lastPart = parts[parts.length - 1] as string;
    current[lastPart] = ((current[lastPart] as number) || 0) + 1;

    // Update run metadata
    await this.db
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
  }
}
