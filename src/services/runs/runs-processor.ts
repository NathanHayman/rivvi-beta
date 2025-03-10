// src/services/runs/run-processor.ts

import { isProduction } from "@/lib/enviroment";
import {
  triggerEvent,
  triggerRowStatusUpdate,
  triggerRunStatusChange,
  triggerRunUpdate,
} from "@/lib/pusher-server";
import { createRetellCall } from "@/lib/retell/retell-client-safe";
import type { RowStatus } from "@/server/db/schema"; // Import the RowStatus type
import {
  calls,
  campaignTemplates,
  campaigns,
  organizations,
  outreachEfforts,
  rows,
  runs,
} from "@/server/db/schema";
import { patientService } from "@/services/patients";
import { createId } from "@paralleldrive/cuid2";
import { toZonedTime } from "date-fns-tz";
import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";

export class RunProcessor {
  private db;
  private processingRuns: Set<string> = new Set();
  private scheduledRuns: Map<string, NodeJS.Timeout> = new Map();
  private callBatchSizes: Map<string, number> = new Map(); // Track optimal batch sizes
  private processorId: string;

  // Rate limiting
  private lastCallTimes: Map<string, number> = new Map(); // runId -> timestamp
  private rateLimitErrors: Map<string, number> = new Map(); // runId -> count
  private metricUpdateTimeouts = new Map<string, NodeJS.Timeout>();
  private debounceTimeouts = new Map<string, NodeJS.Timeout>();

  // Batching configuration
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly INITIAL_BATCH_SIZE = 10;
  private readonly MIN_BATCH_SIZE = 1;
  private readonly MAX_BATCH_SIZE = 20;
  private readonly BATCH_ADJUSTMENT_FACTOR = 0.75; // Reduce by 25% on errors

  constructor(dbInstance) {
    this.db = dbInstance;
    this.processorId = `proc-${createId()}`; // Generate unique ID for this processor
    console.log(`Created RunProcessor with ID: ${this.processorId}`);
  }

  /**
   * Schedule a run for execution at a future time
   */
  async scheduleRun(
    runId: string,
    scheduleTime: string,
    orgId: string,
  ): Promise<void> {
    try {
      // Clear any existing schedule for this run
      this.clearScheduledRun(runId);

      const scheduleDate = new Date(scheduleTime);
      const now = new Date();

      // Calculate delay in milliseconds
      const delay = Math.max(0, scheduleDate.getTime() - now.getTime());

      console.log(
        `Scheduling run ${runId} for ${scheduleDate.toISOString()}, delay: ${delay}ms`,
      );

      // Update run status to scheduled with proper metadata
      await this.db
        .update(runs)
        .set({
          status: "scheduled",
          scheduledAt: scheduleDate,
          metadata: {
            rows: { total: 0, invalid: 0 },
            calls: {
              total: 0,
              completed: 0,
              failed: 0,
              calling: 0,
              pending: 0,
              skipped: 0,
              voicemail: 0,
              connected: 0,
              converted: 0,
            },
            run: {
              scheduledTime: scheduleDate.toISOString(),
              scheduledBy: "system",
              scheduledAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      // Send real-time update
      await triggerEvent(`org-${orgId}`, "run-updated", {
        runId,
        status: "scheduled",
        metadata: {
          scheduledTime: scheduleDate.toISOString(),
        },
      });

      // Schedule the run with proper error handling
      try {
        const timeout = setTimeout(() => {
          this.startRun(runId, orgId).catch((err) => {
            console.error(`Error starting scheduled run ${runId}:`, err);

            // Update run with error information
            this.db
              .update(runs)
              .set({
                status: "failed",
                metadata: {
                  rows: { total: 0, invalid: 0 },
                  calls: {
                    total: 0,
                    completed: 0,
                    failed: 0,
                    calling: 0,
                    pending: 0,
                    skipped: 0,
                    voicemail: 0,
                    connected: 0,
                    converted: 0,
                  },
                  run: {
                    scheduledTime: scheduleDate.toISOString(),
                    error: err instanceof Error ? err.message : String(err),
                    errorTime: new Date().toISOString(),
                  },
                },
              })
              .where(eq(runs.id, runId))
              .then(() => {
                // Send error notification
                return triggerEvent(`run-${runId}`, "run-paused", {
                  reason: err instanceof Error ? err.message : String(err),
                  pausedAt: new Date().toISOString(),
                });
              })
              .catch((e) => {
                console.error(`Failed to update run ${runId} with error:`, e);
              });
          });
        }, delay);

        // Store the timeout for potential cancellation
        this.scheduledRuns.set(runId, timeout);
      } catch (err) {
        console.error(`Error setting timeout for run ${runId}:`, err);
        throw new Error(
          `Failed to schedule run: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } catch (error) {
      console.error(`Error scheduling run ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Clear a scheduled run
   */
  clearScheduledRun(runId: string): void {
    const timeout = this.scheduledRuns.get(runId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledRuns.delete(runId);
      console.log(`Cleared scheduled run ${runId}`);
    }
  }

  /**
   * Start a run immediately
   */
  async startRun(runId: string, orgId: string): Promise<void> {
    try {
      console.log(`Starting run ${runId} for org ${orgId}`);

      // Get run details
      const [run] = await this.db
        .select()
        .from(runs)
        .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

      if (!run) {
        throw new Error(`Run ${runId} not found for org ${orgId}`);
      }

      if (run.status === "completed") {
        console.log(`Run ${runId} is already completed`);
        return;
      }

      if (run.status === "running") {
        console.log(`Run ${runId} is already running`);
        return;
      }

      // Get campaign for agent ID
      const [campaign] = await this.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, run.campaignId));

      if (!campaign) {
        throw new Error(
          `Campaign ${run.campaignId} not found for run ${runId}`,
        );
      }

      // Get template to access agent ID
      const [template] = await this.db
        .select()
        .from(campaignTemplates)
        .where(eq(campaignTemplates.id, campaign.templateId));

      if (!template) {
        throw new Error(
          `Template ${campaign.templateId} not found for campaign ${campaign.id}`,
        );
      }

      // ENHANCEMENT: Verify webhook configuration for agent
      try {
        console.log(
          `Verifying webhook configuration for agent ${template.agentId}`,
        );

        // Import Retell client functions
        const { getAgentComplete, updateAgentWebhooks } = await import(
          "@/lib/retell/retell-client-safe"
        );

        // Get the current agent configuration to verify webhooks
        const agentData = await getAgentComplete(template.agentId);

        // Get base URL for webhooks
        const baseUrl = isProduction
          ? "https://app.rivvi.ai"
          : "https://pleasing-actually-wahoo.ngrok-free.app";

        // Check if webhooks are configured correctly
        const needsUpdate =
          !agentData.combined.webhook_url ||
          !agentData.combined.webhook_url.includes(
            `/api/webhooks/retell/${orgId}/post-call`,
          );

        if (needsUpdate) {
          console.log(`Updating webhook URLs for agent ${template.agentId}`);

          // Update webhooks
          await updateAgentWebhooks(template.agentId, orgId, campaign.id, {
            baseUrl,
            setInbound: true,
            setPostCall: true,
          });

          console.log(
            `Successfully updated webhooks for agent ${template.agentId}`,
          );
        } else {
          console.log(
            `Webhook URLs are already correctly configured for agent ${template.agentId}`,
          );
        }
      } catch (webhookError) {
        // Log but don't fail the run
        console.error(
          `Warning: Failed to verify webhook configuration: ${webhookError}`,
        );
      }

      // Make sure all rows are in the correct initial state
      await this.db
        .update(rows)
        .set({
          status: "pending",
          updatedAt: new Date(),
          // Add a note in metadata about the reset
          metadata: sql`
            CASE 
              WHEN ${rows.status} = 'calling' 
              THEN jsonb_set(
                COALESCE(${rows.metadata}, '{}'::jsonb), 
                '{statusReset}', 
                '"true"'::jsonb
              )
              ELSE ${rows.metadata}
            END
          `,
        })
        .where(
          and(
            eq(rows.runId, runId),
            or(
              eq(rows.status, "calling"), // Reset any rows stuck in calling state
              eq(rows.status, "pending"), // Ensure pending rows are properly set
            ),
          ),
        );

      // Log how many rows were reset from calling state
      const [{ count }] = await this.db
        .select({
          count: sql`COUNT(*)`.mapWith(Number),
        })
        .from(rows)
        .where(
          and(
            eq(rows.runId, runId),
            sql`${rows.metadata}->>'statusReset' = 'true'`,
          ),
        );

      if (count > 0) {
        console.log(
          `Reset ${count} rows from 'calling' to 'pending' state for run ${runId}`,
        );
      }

      // Update run status to running
      await this.db
        .update(runs)
        .set({
          status: "running",
          updatedAt: new Date(),
          metadata: {
            ...run.metadata,
            run: {
              ...(run.metadata?.run || {}),
              startTime: new Date().toISOString(),
            },
          },
        })
        .where(eq(runs.id, runId));

      // Trigger real-time updates
      try {
        // Send both org-level and run-level updates
        await triggerRunUpdate(orgId, runId, "running", {
          run: {
            ...(run.metadata?.run || {}),
            startTime: new Date().toISOString(),
          },
        });

        await triggerRunStatusChange(runId, "running");
        console.log(`Sent real-time updates for run ${runId} start`);
      } catch (pusherError) {
        console.error(
          `Error sending real-time updates for run ${runId}:`,
          pusherError,
        );
        // Continue processing even if Pusher update fails
      }

      // Process run in the background
      this.processRun(runId, orgId).catch((error) => {
        console.error(`Error processing run ${runId}:`, error);
      });
    } catch (error) {
      console.error(`Error starting run ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Check for scheduled runs and start them if needed
   */
  async checkScheduledRuns(): Promise<void> {
    try {
      // Find runs that are scheduled to start now or in the past
      const now = new Date();
      const scheduledRuns = await this.db
        .select()
        .from(runs)
        .where(and(eq(runs.status, "scheduled"), lt(runs.scheduledAt, now)));

      console.log(`Found ${scheduledRuns.length} scheduled runs to start`);

      // Start each run
      for (const run of scheduledRuns) {
        this.startRun(run.id, run.orgId).catch((err) => {
          console.error(`Error starting scheduled run ${run.id}:`, err);
        });
      }
    } catch (error) {
      console.error("Error checking scheduled runs:", error);
    }
  }

  /**
   * Check if current time is within office hours for an organization
   */
  async isWithinOfficeHours(orgId: string): Promise<boolean> {
    try {
      // Get organization details
      const [org] = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (!org) {
        console.warn(
          `Organization ${orgId} not found, defaulting to 24/7 operation`,
        );
        return true; // Default to 24/7 operation if org not found
      }

      // If office hours are not configured, default to 24/7 operation
      if (!org.timezone || !org.officeHours) {
        console.log(
          `Office hours not configured for org ${orgId}, defaulting to 24/7 operation`,
        );
        return true;
      }

      const timezone = org.timezone;
      const officeHours = org.officeHours as Record<
        string,
        { start: string; end: string }
      >;

      // Convert current time to organization's timezone
      const now = new Date();

      try {
        const zonedNow = toZonedTime(now, timezone);

        // Get day of week (0 = Sunday, 6 = Saturday)
        const dayOfWeek = zonedNow.getDay();

        // Map day number to day name
        const dayNames = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ];
        const dayName = dayNames[dayOfWeek];

        // Get current time as hours and minutes
        const hours = zonedNow.getHours();
        const minutes = zonedNow.getMinutes();
        const currentTime = hours * 60 + minutes; // Convert to minutes since midnight

        // Get the hours configuration for the current day
        const dayConfig = officeHours[dayName];

        if (!dayConfig || !dayConfig.start || !dayConfig.end) {
          console.log(
            `No hours configured for ${dayName}, not within office hours`,
          );
          return false;
        }

        // Parse start and end times
        const [startHours, startMinutes] = dayConfig.start
          .split(":")
          .map(Number);
        const [endHours, endMinutes] = dayConfig.end.split(":").map(Number);

        const startTime = startHours * 60 + (startMinutes || 0);
        const endTime = endHours * 60 + (endMinutes || 0);

        // Special case: if start and end are both 0:00, assume not operating
        if (startTime === 0 && endTime === 0) {
          console.log(`Hours set to 00:00-00:00 for ${dayName}, not operating`);
          return false;
        }

        // Special case: if start and end are both 00:00-23:59, assume 24 hour operation
        if (startTime === 0 && endTime === 23 * 60 + 59) {
          console.log(
            `Hours set to 00:00-23:59 for ${dayName}, 24-hour operation`,
          );
          return true;
        }

        // Check if current time is within office hours
        const isWithinHours =
          currentTime >= startTime && currentTime <= endTime;
        console.log(
          `Time check for ${dayName}: ${currentTime} minutes, range ${startTime}-${endTime} minutes, within hours: ${isWithinHours}`,
        );

        return isWithinHours;
      } catch (timezoneError) {
        console.error(`Error processing timezone ${timezone}:`, timezoneError);
        return true; // Default to allowing calls on timezone error
      }
    } catch (error) {
      console.error(`Error checking office hours for org ${orgId}:`, error);
      return true; // Default to allowing calls on error
    }
  }

  /**
   * Dynamically adjust batch size based on success/failure
   */
  private adjustBatchSize(runId: string, increase: boolean) {
    const currentSize =
      this.callBatchSizes.get(runId) || this.INITIAL_BATCH_SIZE;

    if (increase) {
      // Increase by 1 at a time, don't exceed max
      const newSize = Math.min(this.MAX_BATCH_SIZE, currentSize + 1);
      this.callBatchSizes.set(runId, newSize);
    } else {
      // Reduce by factor, don't go below min
      const newSize = Math.max(
        this.MIN_BATCH_SIZE,
        Math.floor(currentSize * this.BATCH_ADJUSTMENT_FACTOR),
      );
      this.callBatchSizes.set(runId, newSize);
    }

    console.log(
      `Adjusted batch size for run ${runId}: ${currentSize} → ${this.callBatchSizes.get(runId)}`,
    );
  }

  /**
   * Helper method for delay with Promise
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Mark a row as calling - FIXED VERSION
   */
  async markRowAsCalling(row: any) {
    try {
      console.log(
        `Attempting to mark row ${row.id} as calling from status: ${row.status}`,
      );

      // First verify the row is in pending status before attempting update
      const [currentRow] = await this.db
        .select()
        .from(rows)
        .where(eq(rows.id, row.id));

      if (!currentRow) {
        console.warn(`Row ${row.id} not found, cannot mark as calling`);
        return null;
      }

      if (currentRow.status !== "pending") {
        console.log(
          `Row ${row.id} is not in pending state (current: ${currentRow.status}), skipping`,
        );
        return null;
      }

      // Simplified atomic update - no transaction needed
      const updatedRows = await this.db
        .update(rows)
        .set({
          status: "calling",
          updatedAt: new Date(),
          callAttempts: (row.callAttempts || 0) + 1,
          metadata: {
            ...row.metadata,
            lastCallTime: new Date().toISOString(),
          },
        })
        .where(eq(rows.id, row.id))
        .returning();

      // Send real-time update via Pusher
      if (updatedRows.length > 0) {
        const updatedRow = updatedRows[0];

        try {
          // Trigger row status update event
          await triggerRowStatusUpdate(
            updatedRow.runId,
            updatedRow.id,
            "calling",
            {
              lastCallTime: new Date().toISOString(),
              callAttempts: updatedRow.callAttempts || 1,
            },
          );
          console.log(`Sent real-time update for row ${updatedRow.id}`);
        } catch (pusherError) {
          console.error(
            `Error sending real-time update for row ${updatedRow.id}:`,
            pusherError,
          );
          // Continue processing even if Pusher update fails
        }

        return updatedRows[0];
      }

      // If we get here, no rows were updated
      console.log(`No rows updated for id ${row.id}`);
      return null;
    } catch (error) {
      console.error(`Error updating row ${row.id} status:`, error);
      throw error;
    }
  }

  /**
   * Helper to create a NOT IN condition
   */
  private notInArray(column: any, values: any[]) {
    if (values.length === 0) {
      return sql`TRUE`;
    }

    // Use the not operator with inArray instead of raw SQL
    if (values.length === 1) {
      return sql`${column} <> ${values[0]}`;
    } else {
      return sql`NOT (${column} IN (${sql.join(values)}))`;
    }
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

    console.log(`Starting to process run ${runId} for org ${orgId}`);
    // Add run to processing set
    this.processingRuns.add(runId);

    // Initialize batch size for this run if not already set
    if (!this.callBatchSizes.has(runId)) {
      this.callBatchSizes.set(runId, this.INITIAL_BATCH_SIZE);
    }

    // Initialize a Set to track rows already being processed in this batch
    const processedRowIds = new Set<string>();

    let processing = true;
    let consecutiveErrors = 0;
    let currentRun: any = null;
    let lastStuckRowCheck = Date.now();
    let lastRowsProcessedTime = Date.now();

    try {
      while (processing) {
        // Get run details with all relevant data
        const [run] = await this.db
          .select()
          .from(runs)
          .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

        currentRun = run;

        if (!run) {
          console.error(`Run ${runId} not found, stopping processing`);
          processing = false;
          continue;
        }

        if (run.status !== "running") {
          console.log(
            `Run ${runId} is not running (status: ${run.status}), stopping processing`,
          );
          processing = false;
          continue;
        }

        // Check if within office hours
        const withinHours = await this.isWithinOfficeHours(orgId);
        if (!withinHours) {
          console.log(
            `Run ${runId} paused: outside of office hours for org ${orgId}`,
          );

          // Update run status to reflect pause
          await this.db
            .update(runs)
            .set({
              status: "paused",
              metadata: {
                ...run.metadata,
                run: {
                  ...run.metadata?.run,
                  pausedOutsideHours: true,
                  lastPausedAt: new Date().toISOString(),
                },
              },
              updatedAt: new Date(),
            })
            .where(eq(runs.id, runId));

          // Send event to notify about pause
          await triggerEvent(`run-${runId}`, "run-paused", {
            reason: "outside_office_hours",
            pausedAt: new Date().toISOString(),
          });

          // Wait before checking again (15 minutes)
          await this.delay(15 * 60 * 1000);
          continue;
        }

        // Get organization for concurrency and settings
        const [organization] = await this.db
          .select()
          .from(organizations)
          .where(eq(organizations.id, orgId));

        if (!organization) {
          throw new Error(
            `Organization ${orgId} not found, cannot process run`,
          );
        }

        // Get campaign for agent ID and configuration
        const [campaign] = await this.db
          .select()
          .from(campaigns)
          .where(eq(campaigns.id, run.campaignId));

        if (!campaign) {
          throw new Error(
            `Campaign ${run.campaignId} not found, cannot process run`,
          );
        }

        // Get the campaign template to access agentId
        const [template] = await this.db
          .select()
          .from(campaignTemplates)
          .where(eq(campaignTemplates.id, campaign.templateId));

        if (!template) {
          throw new Error(
            `Template for campaign ${campaign.id} not found, cannot process run`,
          );
        }

        // Check concurrency limits
        const concurrencyLimit = organization.concurrentCallLimit || 20;

        // Get active calls count with a single query
        const [activeCallCounts] = await this.db
          .select({
            runCallCount: sql`COUNT(*) FILTER (WHERE ${calls.runId} = ${runId} AND 
                          (${calls.status} = 'pending' OR ${calls.status} = 'in-progress'))`,
            orgCallCount: sql`COUNT(*) FILTER (WHERE ${calls.orgId} = ${orgId} AND 
                         (${calls.status} = 'pending' OR ${calls.status} = 'in-progress'))`,
          })
          .from(calls);

        const activeCalls = Number(activeCallCounts.runCallCount || 0);
        const orgActiveCalls = Number(activeCallCounts.orgCallCount || 0);

        const availableSlots = Math.min(
          concurrencyLimit - orgActiveCalls,
          concurrencyLimit - activeCalls,
        );

        console.log(
          `Active calls - Run: ${activeCalls}, Org: ${orgActiveCalls}, Available slots: ${availableSlots}`,
        );

        if (availableSlots <= 0) {
          console.log(`No available call slots for run ${runId}, waiting...`);
          // No available slots, wait before checking again
          await this.delay(5000);
          continue;
        }

        // Clear processed row set if it's been more than 10 seconds since last processing
        const now = Date.now();
        if (now - lastRowsProcessedTime > 10000) {
          processedRowIds.clear();
          lastRowsProcessedTime = now;
        }

        // Get current batch size, dynamically adjusted based on success/failure rates
        const currentBatchSize =
          this.callBatchSizes.get(runId) || this.INITIAL_BATCH_SIZE;

        // Respect rate limits to avoid overwhelming the call center
        const callsPerMinute = run.metadata?.run?.callsPerMinute || 10;
        const delayBetweenCalls = Math.max(
          1000,
          Math.floor(60000 / callsPerMinute),
        );

        // Limit batch size to available slots
        const batchSize = Math.min(availableSlots, currentBatchSize);

        console.log(
          `Using batch size: ${batchSize}, calls per minute: ${callsPerMinute}, delay: ${delayBetweenCalls}ms`,
        );

        // Get next batch of pending rows with priority ordering
        const pendingRows = await this.db
          .select()
          .from(rows)
          .where(
            and(
              eq(rows.runId, runId),
              eq(rows.status, "pending"),
              // Exclude rows we're already processing in this batch
              this.notInArray(rows.id, Array.from(processedRowIds)),
            ),
          )
          .orderBy(
            // First by priority if available
            desc(sql`COALESCE((${rows.variables}->>'priority')::int, 0)`),
            // Then by sort index
            asc(rows.sortIndex),
          )
          .limit(batchSize);

        console.log(`Found ${pendingRows.length} pending rows to process`);

        if (pendingRows.length === 0) {
          // If no new rows to process, check if there are any active rows still in progress
          const [{ value: activeRowCount }] = await this.db
            .select({
              value: sql`COUNT(*)`,
            })
            .from(rows)
            .where(
              and(
                eq(rows.runId, runId),
                or(eq(rows.status, "pending"), eq(rows.status, "calling")),
              ),
            );

          const pendingRowCount = Number(activeRowCount);
          console.log(
            `No new rows to process, active rows: ${pendingRowCount}`,
          );

          if (pendingRowCount === 0) {
            console.log(`No remaining rows, completing run ${runId}`);
            // Update run to completed
            await this.completeRun(runId, orgId);
            processing = false;
          } else {
            // Wait before checking again if there are still active rows
            await this.delay(5000);
          }
          continue;
        }

        // Add all rows in this batch to the processed set to prevent double-processing
        pendingRows.forEach((row) => processedRowIds.add(row.id));
        lastRowsProcessedTime = Date.now();

        // Process each row in batch with improved error handling
        console.log(`Starting to process batch of ${pendingRows.length} rows`);

        // Track batch success rate for dynamic batch sizing
        let successCount = 0;
        let failedCalls = 0;

        for (const row of pendingRows) {
          // Skip if no longer within office hours
          if (!(await this.isWithinOfficeHours(orgId))) {
            console.log(
              `Stopping batch: outside of office hours for org ${orgId}`,
            );
            break;
          }

          try {
            // Apply rate limiting based on last call time
            const now = Date.now();
            const lastCallTime = this.lastCallTimes.get(runId) || 0;
            const timeSinceLastCall = now - lastCallTime;

            if (timeSinceLastCall < delayBetweenCalls) {
              const waitTime = delayBetweenCalls - timeSinceLastCall;
              console.log(
                `Rate limiting: waiting ${waitTime}ms before next call`,
              );
              await this.delay(waitTime);
            }

            // Try to mark this row as calling
            const updatedRow = await this.markRowAsCalling(row);

            // If we couldn't claim the row, skip to the next one
            if (!updatedRow) {
              console.log(`Skipping row ${row.id} - couldn't claim it`);
              continue;
            }

            // Get phone number from row variables with fallbacks
            const phone =
              row.variables.phone ||
              row.variables.primaryPhone ||
              row.variables.phoneNumber;

            if (!phone) {
              throw new Error("No phone number found in row variables");
            }

            // Check for time zone restrictions if specified
            if (
              row.variables.timezone &&
              run.metadata?.run?.respectPatientTimezone
            ) {
              const patientTimezone = String(row.variables.timezone);

              try {
                // Convert current time to patient's timezone
                const now = new Date();
                const zonedNow = toZonedTime(now, patientTimezone);
                const patientHour = zonedNow.getHours();

                // Check if within allowed calling hours (default 8am-8pm)
                const startHour =
                  (run.metadata?.run?.callStartHour as number) || 8;
                const endHour =
                  (run.metadata?.run?.callEndHour as number) || 20;

                if (patientHour < startHour || patientHour >= endHour) {
                  console.log(
                    `Skipping call to ${phone} due to timezone restrictions (current time for patient: ${patientHour}:00)`,
                  );

                  // Mark for retry later
                  await this.db
                    .update(rows)
                    .set({
                      status: "pending",
                      updatedAt: new Date(),
                      retryCount: (row.retryCount || 0) + 1,
                      metadata: {
                        ...row.metadata,
                        lastSkipReason: "timezone_restriction",
                        lastSkipTime: new Date().toISOString(),
                      },
                    })
                    .where(eq(rows.id, row.id));

                  // Update run metrics
                  await this.incrementMetric(runId, "calls.skipped");

                  continue;
                }
              } catch (error) {
                console.error(`Error checking timezone for ${phone}:`, error);
                // Continue with call if timezone check fails
              }
            }

            // Find or create patient from row data
            let patientId = row.patientId;

            // Process patient data if no ID yet
            if (!patientId && row.variables) {
              try {
                const firstName =
                  row.variables.firstName || row.variables.first_name;
                const lastName =
                  row.variables.lastName || row.variables.last_name;
                const dob = row.variables.dob || row.variables.dateOfBirth;

                if (firstName && lastName && phone) {
                  // Use patient service to find or create patient
                  const patientResult = await patientService.findOrCreate({
                    firstName: String(firstName),
                    lastName: String(lastName),
                    dob: String(dob || new Date().toISOString().split("T")[0]),
                    phone: String(phone),
                    orgId,
                  });

                  if (patientResult.success) {
                    patientId = patientResult.data.id;

                    // Update row with patient ID if found
                    await this.db
                      .update(rows)
                      .set({ patientId })
                      .where(eq(rows.id, row.id));
                  }
                }
              } catch (patientError) {
                console.error("Error processing patient data:", patientError);
                // Continue without patient ID if processing fails
              }
            }

            // Prepare variables for the call with improved merging
            const rawVariables = {
              // Base variables from row
              ...row.variables,

              // Add run-specific variables
              custom_prompt: run.customPrompt || undefined,
              organization_name: organization.name,
              campaign_name: campaign.name,
              retry_count: row.retryCount || 0,

              // Ensure patient fields are explicitly mapped
              patient_first_name:
                row.variables.firstName || row.variables.first_name,
              patient_last_name:
                row.variables.lastName || row.variables.last_name,
              patient_phone: phone,

              // For compatibility with different templates
              first_name: row.variables.firstName || row.variables.first_name,
              last_name: row.variables.lastName || row.variables.last_name,
              phone: phone,
            };

            // Ensure all variables are strings for Retell API
            const callVariables: Record<string, string> = {};
            for (const [key, value] of Object.entries(rawVariables)) {
              if (value !== undefined && value !== null) {
                callVariables[key] = String(value);
              }
            }

            // Create call in Retell with enhanced context and error handling
            console.log(`Starting call to ${phone} for row ${row.id}`);

            const retellCall = await createRetellCall({
              toNumber: String(phone),
              fromNumber: organization.phone || "",
              agentId: template.agentId,
              variables: callVariables,
              metadata: {
                runId,
                rowId: row.id,
                orgId,
                campaignId: campaign.id,
                patientId,
                timezone: organization.timezone || "America/New_York",
              },
            });

            // Update last call time for rate limiting
            this.lastCallTimes.set(runId, Date.now());

            // Log the complete Retell response for diagnostics
            console.log(
              `Retell API response for row ${row.id}:`,
              JSON.stringify(retellCall, null, 2),
            );

            if (!retellCall.ok || !retellCall.call_id) {
              // If call creation fails, update row status back to pending for retry later

              // Check if there might be a successful call despite the error response
              // Sometimes the Retell API might return an error but still create the call
              console.warn(
                `Call creation reported failure for row ${row.id}, checking if call was actually created...`,
              );

              // Wait a moment to allow any webhook callbacks to arrive
              await this.delay(3000);

              // Check if we've received any webhooks for this call in the interim
              // This lookup would need to be implemented based on your webhook handling logic
              try {
                const [existingCall] = await this.db
                  .select()
                  .from(calls)
                  .where(
                    and(
                      eq(calls.rowId, row.id),
                      eq(calls.runId, runId),
                      gt(calls.createdAt, new Date(Date.now() - 60000)), // Created in the last minute
                    ),
                  )
                  .limit(1);

                if (existingCall) {
                  console.log(
                    `Found existing call ${existingCall.id} for row ${row.id}, considering call as successful despite error`,
                  );

                  // Update row with retell call id if present
                  await this.db
                    .update(rows)
                    .set({
                      status: "calling",
                      updatedAt: new Date(),
                      callAttempts: (row.callAttempts || 0) + 1,
                      retellCallId: existingCall.retellCallId,
                      metadata: {
                        ...row.metadata,
                        lastCallTime: new Date().toISOString(),
                        retellCallId: existingCall.retellCallId,
                        callDispatched: true,
                        dispatchedAt: new Date().toISOString(),
                        retellError:
                          retellCall.error ||
                          "Unknown error but call was created",
                      },
                    })
                    .where(eq(rows.id, row.id));

                  // Continue with next row since we found a successful call
                  successCount++;
                  continue;
                }
              } catch (checkError) {
                console.error(
                  `Error checking for existing call for row ${row.id}:`,
                  checkError,
                );
                // Fall through to standard error handling
              }

              // Standard error handling if we didn't find an existing call
              await this.db
                .update(rows)
                .set({
                  status: "pending", // Reset to pending so it can be retried
                  updatedAt: new Date(),
                  metadata: {
                    ...row.metadata,
                    lastError: `Failed to create Retell call: ${retellCall.error || "Unknown error"}`,
                    lastErrorAt: new Date().toISOString(),
                  },
                })
                .where(eq(rows.id, row.id));

              console.error(
                `Error dispatching call for row ${row.id}: Failed to create Retell call: ${retellCall.error || "Unknown error"}`,
              );
              continue; // Skip to next row instead of throwing, which would stop the entire process
            }

            console.log(`Retell call created with ID: ${retellCall.call_id}`);

            // Make sure row status remains as "calling" and update with retellCallId
            const updatedRowResult = await this.db
              .update(rows)
              .set({
                status: "calling", // Explicitly ensure status is "calling"
                retellCallId: retellCall.call_id,
                updatedAt: new Date(),
                callAttempts: (row.callAttempts || 0) + 1,
                metadata: {
                  ...row.metadata,
                  lastCallTime: new Date().toISOString(),
                  retellCallId: retellCall.call_id,
                  callDispatched: true, // Flag to indicate call was dispatched
                  dispatchedAt: new Date().toISOString(),
                },
              })
              .where(eq(rows.id, row.id))
              .returning();

            // Verify row update was successful
            if (!updatedRowResult || updatedRowResult.length === 0) {
              console.warn(
                `Failed to update row ${row.id} status after dispatching call. This may cause duplicate calls.`,
              );

              // Force re-update as last resort
              try {
                await this.db
                  .update(rows)
                  .set({
                    status: "calling",
                    updatedAt: new Date(),
                    metadata: {
                      ...row.metadata,
                      forceUpdated: true,
                      forceUpdatedAt: new Date().toISOString(),
                      retellCallId: retellCall.call_id,
                    },
                  })
                  .where(eq(rows.id, row.id));
              } catch (finalError) {
                console.error(
                  `Critical: Failed to force-update row ${row.id} status:`,
                  finalError,
                );
              }
            } else {
              console.log(
                `Successfully updated row ${row.id} to "calling" state with Retell call ID ${retellCall.call_id}`,
              );
            }

            // Create call record with enhanced tracking
            const [newCall] = await this.db
              .insert(calls)
              .values({
                orgId,
                runId,
                rowId: row.id,
                patientId,
                agentId: template.agentId,
                campaignId: campaign.id,
                direction: "outbound",
                status: "pending",
                retellCallId: retellCall.call_id,
                toNumber: String(phone),
                fromNumber: organization.phone || "",
                metadata: {
                  variables: callVariables,
                  attempt: (row.callAttempts || 0) + 1,
                  rowMetadata: row.metadata,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();

            // Create outreach effort record at the time of call dispatch
            try {
              const [newOutreachEffort] = await this.db
                .insert(outreachEfforts)
                .values({
                  orgId,
                  patientId,
                  campaignId: campaign.id,
                  runId,
                  rowId: row.id,
                  originalCallId: newCall.id,
                  lastCallId: newCall.id,
                  resolutionStatus: "open",
                  direction: "outbound",
                  agentId: template.agentId,
                  variables: callVariables,
                  metadata: {
                    firstCallTime: new Date().toISOString(),
                    callStatus: "pending",
                  },
                })
                .returning();

              // Update the call with the outreach effort ID
              await this.db
                .update(calls)
                .set({
                  outreachEffortId: newOutreachEffort.id,
                })
                .where(eq(calls.id, newCall.id));

              console.log(
                `Created outreach effort ${newOutreachEffort.id} for call ${newCall.id}`,
              );
            } catch (outreachError) {
              console.error(
                `Error creating outreach effort for call ${newCall.id}:`,
                outreachError,
              );
              // Continue processing even if outreach effort creation fails
            }

            // Update run metrics
            await this.incrementMetric(runId, "calls.calling");

            // Update timestamps for analytics
            await this.db
              .update(runs)
              .set({
                metadata: {
                  ...run.metadata,
                  run: {
                    ...run.metadata?.run,
                    lastCallTime: new Date().toISOString(),
                  },
                },
                updatedAt: new Date(),
              })
              .where(eq(runs.id, runId));

            // Send real-time update via Pusher
            await triggerEvent(`run-${runId}`, "call-started", {
              rowId: row.id,
              callId: newCall.id,
              // retellCallId: retellCall.call_id,
              variables: callVariables,
            });

            // Also send org-level notification
            await triggerEvent(`org-${orgId}`, "call-started", {
              runId,
              rowId: row.id,
              callId: newCall.id,
              // retellCallId: retellCall.call_id,
            });

            console.log(
              `Call created successfully for row ${row.id} with ID ${newCall.id} (Retell ID: ${retellCall.call_id})`,
            );

            // Track batch success for dynamic sizing
            successCount++;
            consecutiveErrors = 0;
          } catch (error) {
            console.error(`Error dispatching call for row ${row.id}:`, error);

            // Track batch failures for dynamic sizing
            failedCalls++;
            consecutiveErrors++;

            // Determine if we should retry
            const maxRetries =
              (run.metadata?.run?.maxRetries as number) ||
              this.MAX_RETRY_ATTEMPTS;
            const currentRetries = row.retryCount || 0;

            try {
              if (currentRetries < maxRetries) {
                console.log(
                  `Will retry row ${row.id} later (${currentRetries + 1}/${maxRetries} retries)`,
                );

                // Mark for retry
                await this.db
                  .update(rows)
                  .set({
                    status: "pending", // Ensure status is reset to pending
                    retryCount: currentRetries + 1,
                    error:
                      error instanceof Error ? error.message : String(error),
                    updatedAt: new Date(),
                    metadata: {
                      ...row.metadata,
                      lastError:
                        error instanceof Error ? error.message : String(error),
                      lastErrorTime: new Date().toISOString(),
                    },
                  })
                  .where(eq(rows.id, row.id));

                // Update run metrics
                await this.incrementMetric(runId, "calls.retried");
              } else {
                // Mark as failed - exceeded max retries
                await this.db
                  .update(rows)
                  .set({
                    status: "failed", // Ensure status is set to failed
                    error: `Exceeded maximum retries (${maxRetries}): ${error instanceof Error ? error.message : String(error)}`,
                    updatedAt: new Date(),
                    metadata: {
                      ...row.metadata,
                      lastError:
                        error instanceof Error ? error.message : String(error),
                      lastErrorTime: new Date().toISOString(),
                      failureReason: "max_retries_exceeded",
                    },
                  })
                  .where(eq(rows.id, row.id));

                // Update run metrics
                await this.incrementMetric(runId, "calls.failed");
              }
            } catch (dbError) {
              // Handle database errors during status update
              console.error(
                `Failed to update row ${row.id} status after error:`,
                dbError,
              );

              // Last resort attempt to reset the row status
              try {
                await this.db
                  .update(rows)
                  .set({
                    status: "pending",
                    error: "Failed to process call and update status",
                    updatedAt: new Date(),
                  })
                  .where(eq(rows.id, row.id));
              } catch (finalError) {
                console.error(
                  `Critical: Failed final attempt to reset row ${row.id} status:`,
                  finalError,
                );
              }
            }

            // If we hit multiple consecutive errors, consider adjusting batch size or pausing
            if (consecutiveErrors >= 3) {
              console.log(
                `${consecutiveErrors} consecutive errors, reducing batch size and backing off`,
              );
              this.adjustBatchSize(runId, false);

              // Add a backoff delay to prevent overwhelming the system
              await this.delay(5000 * Math.min(5, consecutiveErrors));
            }
          }
        }

        // After batch processing, adjust batch size based on success rate
        if (pendingRows.length > 0) {
          const successRate = successCount / pendingRows.length;

          if (successRate >= 0.9) {
            // If 90%+ success, consider increasing batch size
            this.adjustBatchSize(runId, true);
          } else if (successRate < 0.7) {
            // If less than 70% success, reduce batch size
            this.adjustBatchSize(runId, false);
          }

          console.log(
            `Batch completed with ${successRate.toFixed(2)}% success rate. New batch size: ${this.callBatchSizes.get(runId)}`,
          );
        }

        // Add a short pause between batches to avoid overwhelming the system
        await this.delay(delayBetweenCalls);

        // Check for stuck rows every minute
        if (Date.now() - lastStuckRowCheck > 60000) {
          await this.checkForStuckRows(runId);
          lastStuckRowCheck = Date.now();
        }

        // Monitor calls in progress to detect webhook failures
        await this.monitorCallsInProgress(runId);

        // Check if run is complete
        const [{ value: activeRowCount }] = await this.db
          .select({
            value: sql`COUNT(*)`,
          })
          .from(rows)
          .where(
            and(
              eq(rows.runId, runId),
              or(eq(rows.status, "pending"), eq(rows.status, "calling")),
            ),
          );

        const pendingRowCount = Number(activeRowCount);
        console.log(
          `No remaining rows, completing run ${runId} with ${pendingRowCount} active rows`,
        );

        if (pendingRowCount === 0) {
          console.log(`No remaining rows, completing run ${runId}`);
          // Update run to completed
          await this.completeRun(runId, orgId);
          processing = false;
        }
      }
    } catch (error) {
      console.error(`Error processing run ${runId}:`, error);

      // Mark run as failed with detailed error info
      await this.db
        .update(runs)
        .set({
          status: "failed",
          metadata: {
            ...(currentRun?.metadata || {}),
            run: {
              ...(currentRun?.metadata?.run || {}),
              error: error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
              errorTime: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      // Send real-time update via Pusher
      await triggerEvent(`org-${orgId}`, "run-updated", {
        runId,
        status: "failed",
        // error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Remove run from processing set
      this.processingRuns.delete(runId);
      // Clear the processed rows set for this run
      processedRowIds.clear();
    }
  }

  /**
   * Mark a run as completed
   */
  async completeRun(runId: string, orgId: string): Promise<void> {
    try {
      console.log(`Completing run ${runId}`);

      // Get run details
      const [run] = await this.db
        .select()
        .from(runs)
        .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

      if (!run) {
        throw new Error(`Run ${runId} not found`);
      }

      // Calculate run duration if start time is available
      const endTime = new Date().toISOString();
      let duration: number | undefined;

      if (run.metadata?.run?.startTime) {
        const startTime = new Date(
          run.metadata.run.startTime as string,
        ).getTime();
        duration = Math.floor((Date.now() - startTime) / 1000); // Duration in seconds
      }

      // Get final run statistics
      const [stats] = await this.db
        .select({
          total: sql`COUNT(*)`,
          completed: sql`COUNT(*) FILTER (WHERE ${rows.status} = 'completed')`,
          failed: sql`COUNT(*) FILTER (WHERE ${rows.status} = 'failed')`,
          skipped: sql`COUNT(*) FILTER (WHERE ${rows.status} = 'skipped')`,
          pending: sql`COUNT(*) FILTER (WHERE ${rows.status} = 'pending' OR ${rows.status} = 'calling')`,
        })
        .from(rows)
        .where(eq(rows.runId, runId));

      // Verify run is actually complete
      if (Number(stats.pending || 0) > 0) {
        console.warn(
          `Run ${runId} still has ${stats.pending} pending rows, not marking as completed`,
        );
        return;
      }

      // Update run status to completed with finalized statistics
      const updatedMetadata = {
        ...run.metadata,
        rows: {
          ...(run.metadata?.rows || {}),
          total: Number(stats.total || 0),
        },
        calls: {
          ...(run.metadata?.calls || {}),
          completed: Number(stats.completed || 0),
          failed: Number(stats.failed || 0),
          skipped: Number(stats.skipped || 0),
          pending: 0,
          calling: 0,
        },
        run: {
          ...(run.metadata?.run || {}),
          endTime,
          duration,
          completedAt: endTime,
          completionStatus: "success",
        },
      };

      await this.db
        .update(runs)
        .set({
          status: "completed",
          metadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      // Send real-time update
      await triggerEvent(`org-${orgId}`, "run-updated", {
        runId,
        status: "completed",
        metadata: updatedMetadata,
      });

      await triggerRunStatusChange(runId, "completed");

      console.log(`Run ${runId} marked as completed successfully`);
    } catch (error) {
      console.error(`Error completing run ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Increment a metric in run metadata with debounced Pusher updates
   */
  async incrementMetric(runId: string, metricPath: string): Promise<void> {
    try {
      // Skip if no run ID
      if (!runId) return;

      // Use debounce to avoid too many DB operations
      const debounceKey = `${runId}-${metricPath}`;
      if (this.debounceTimeouts.has(debounceKey)) {
        clearTimeout(this.debounceTimeouts.get(debounceKey)!);
      }

      this.debounceTimeouts.set(
        debounceKey,
        setTimeout(async () => {
          try {
            // Get the latest run record
            const [run] = await this.db
              .select()
              .from(runs)
              .where(eq(runs.id, runId));

            if (!run) return;

            // Create a deep copy of metadata to avoid reference issues
            const metadata = structuredClone(run.metadata || {});

            // Initialize metrics if not present
            if (!metadata.metrics) {
              metadata.metrics = {};
            }

            // Create nested path in metrics object
            const parts = metricPath.split(".");
            let current = metadata.metrics;

            // Navigate to the correct nested location
            for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              if (!current[part]) {
                current[part] = {};
              }
              current = current[part];
            }

            // Increment the metric
            const lastPart = parts[parts.length - 1] as string;
            current[lastPart] = ((current[lastPart] as number) || 0) + 1;

            // Update run metadata with optimistic concurrency control
            await this.db
              .update(runs)
              .set({
                metadata,
                updatedAt: new Date(),
              })
              .where(eq(runs.id, runId));

            // Emit metrics update event
            await triggerEvent(`run-${runId}`, "metrics-updated", {
              runId,
              metrics: metadata.metrics,
            });
          } catch (error) {
            console.error(`Error incrementing metric ${metricPath}:`, error);
          } finally {
            this.debounceTimeouts.delete(debounceKey);
          }
        }, 500),
      );
    } catch (error) {
      console.error(`Error scheduling metric increment:`, error);
    }
  }

  /**
   * Check for stuck rows and reset them
   */
  private async checkForStuckRows(runId: string): Promise<void> {
    try {
      console.log(`Checking for stuck rows in run ${runId}`);

      // Find rows that have been in "calling" state for more than 5 minutes (reduced from 10)
      const stuckRows = await this.db
        .select()
        .from(rows)
        .where(
          and(
            eq(rows.runId, runId),
            eq(rows.status, "calling"),
            // Check if updatedAt is more than 5 minutes ago (reduced time window)
            sql`${rows.updatedAt} < NOW() - INTERVAL '5 minutes'`,
          ),
        );

      if (stuckRows.length > 0) {
        console.log(
          `Found ${stuckRows.length} rows stuck in "calling" state for run ${runId}`,
        );

        // Track detailed information about stuck rows
        const stuckDetails = stuckRows.map((row) => ({
          id: row.id,
          updatedAt: row.updatedAt,
          minutesStuck: Math.floor(
            (Date.now() - row.updatedAt.getTime()) / (60 * 1000),
          ),
          retellCallId: row.retellCallId,
          metadata: row.metadata,
        }));

        console.log(
          "Stuck row details:",
          JSON.stringify(stuckDetails, null, 2),
        );

        // Reset these rows to "pending" state
        for (const row of stuckRows) {
          // Get any calls associated with this row
          const rowCalls = await this.db
            .select()
            .from(calls)
            .where(
              and(
                eq(calls.rowId, row.id),
                eq(calls.runId, runId),
                or(
                  eq(calls.status, "pending"),
                  eq(calls.status, "in-progress"),
                ),
              ),
            );

          // Log any active calls for this row
          if (rowCalls.length > 0) {
            console.log(
              `Row ${row.id} has ${rowCalls.length} active calls that may need to be checked with Retell API`,
            );
          }

          // Reset the row status
          const updateResult = await this.db
            .update(rows)
            .set({
              status: "pending",
              error: "Reset from stuck 'calling' state",
              updatedAt: new Date(),
              metadata: {
                ...row.metadata,
                stuckInCalling: true,
                resetTime: new Date().toISOString(),
                resetCount: ((row.metadata?.resetCount || 0) as number) + 1,
                previousResetTime: row.metadata?.resetTime,
              },
            })
            .where(eq(rows.id, row.id))
            .returning();

          // Verify the update
          if (updateResult && updateResult.length > 0) {
            console.log(
              `Reset stuck row ${row.id} to "pending" state successfully`,
            );

            // Update run metrics
            await this.incrementMetric(runId, "rows.reset_from_stuck");
          } else {
            console.warn(`Failed to reset stuck row ${row.id}`);
          }
        }

        // Send an event to notify about the stuck rows (using metrics-updated)
        await triggerEvent(`run-${runId}`, "metrics-updated", {
          runId,
          metrics: {
            rows: {
              reset: {
                count: stuckRows.length,
                lastResetAt: new Date().toISOString(),
              },
            },
          },
        });
      }
    } catch (error) {
      console.error(`Error checking for stuck rows in run ${runId}:`, error);
    }
  }

  /**
   * Monitor calls in progress and detect if webhook updates aren't happening properly
   */
  private async monitorCallsInProgress(runId: string): Promise<void> {
    try {
      console.log(`Monitoring calls in progress for run ${runId}`);

      // Get all rows in "calling" state
      const callingRows = await this.db
        .select()
        .from(rows)
        .where(and(eq(rows.runId, runId), eq(rows.status, "calling")));

      if (callingRows.length === 0) {
        console.log(`No rows in 'calling' state for run ${runId}`);
        return;
      }

      console.log(
        `Found ${callingRows.length} rows in 'calling' state for run ${runId}`,
      );

      // Get all calls for these rows to see their status
      const callIds = callingRows
        .filter((row) => row.retellCallId)
        .map((row) => row.retellCallId);

      if (callIds.length === 0) {
        console.log(`No Retell call IDs found for rows in 'calling' state`);
        return;
      }

      // Find calls that are completed but rows are still in calling state
      const completedCalls = await this.db
        .select()
        .from(calls)
        .where(
          and(
            eq(calls.runId, runId),
            inArray(calls.retellCallId, callIds),
            or(
              eq(calls.status, "completed"),
              eq(calls.status, "failed"),
              eq(calls.status, "voicemail"),
              eq(calls.status, "no-answer"),
            ),
          ),
        );

      if (completedCalls.length === 0) {
        console.log(
          `No completed calls found with rows still in 'calling' state`,
        );
        return;
      }

      console.log(
        `Found ${completedCalls.length} completed calls with rows still in 'calling' state - webhook updates may have failed`,
      );

      // Update the rows that should have been updated by webhooks
      for (const call of completedCalls) {
        if (!call.rowId) continue;

        console.log(
          `Fixing row ${call.rowId} stuck in 'calling' state - call ${call.id} (${call.retellCallId}) is already ${call.status}`,
        );

        // Get the current row
        const [row] = await this.db
          .select()
          .from(rows)
          .where(eq(rows.id, call.rowId));

        if (!row || row.status !== "calling") {
          console.log(
            `Row ${call.rowId} is no longer in 'calling' state, skipping`,
          );
          continue;
        }

        // Map call status to row status
        let rowStatus: RowStatus;
        switch (call.status) {
          case "completed":
            rowStatus = "completed";
            break;
          case "failed":
            rowStatus = "failed";
            break;
          case "voicemail":
          case "no-answer":
            rowStatus = "completed"; // Count voicemail as completed
            break;
          default:
            rowStatus = "failed"; // Fallback
        }

        // Update the row status
        await this.db
          .update(rows)
          .set({
            status: rowStatus,
            updatedAt: new Date(),
            metadata: {
              ...row.metadata,
              manuallyFixed: true,
              fixedAt: new Date().toISOString(),
              previousStatus: row.status,
              fixReason: "Webhook update failed - fixed by monitoring",
              callStatus: call.status,
            },
          })
          .where(eq(rows.id, call.rowId));

        console.log(
          `Fixed row ${call.rowId} by setting status to ${rowStatus} (call status: ${call.status})`,
        );

        // Update metrics
        await this.incrementMetric(runId, `calls.${rowStatus}`);
      }
    } catch (error) {
      console.error(
        `Error monitoring calls in progress for run ${runId}:`,
        error,
      );
    }
  }
}
