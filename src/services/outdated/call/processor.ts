// src/services/call/processor.ts
import { pusherServer } from "@/lib/pusher-server";
import { createPhoneCall } from "@/lib/retell-client-safe";
import {
  calls,
  campaigns,
  campaignTemplates,
  organizations,
  rows,
  runs,
} from "@/server/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { toZonedTime } from "date-fns-tz";
import { and, asc, desc, eq, lt, or, sql } from "drizzle-orm";

type DatabaseClient = typeof import("@/server/db").db;

export class CallProcessor {
  private db: DatabaseClient;
  private processingRuns: Set<string> = new Set();
  private scheduledRuns: Map<string, NodeJS.Timeout> = new Map();
  private callBatchSizes: Map<string, number> = new Map(); // Track optimal batch sizes
  private processorId: string;

  // Rate limiting
  private lastCallTimes: Map<string, number> = new Map(); // runId -> timestamp
  private rateLimitErrors: Map<string, number> = new Map(); // runId -> count
  private metricUpdateTimeouts = new Map<string, NodeJS.Timeout>();

  // Batching configuration
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly INITIAL_BATCH_SIZE = 10;
  private readonly MIN_BATCH_SIZE = 1;
  private readonly MAX_BATCH_SIZE = 20;
  private readonly BATCH_ADJUSTMENT_FACTOR = 0.75; // Reduce by 25% on errors

  constructor(db: DatabaseClient) {
    this.db = db;
    this.processorId = `proc-${createId()}`; // Generate unique ID for this processor
    console.log(`Created CallProcessor with ID: ${this.processorId}`);
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
        } as Partial<typeof runs.$inferInsert>)
        .where(eq(runs.id, runId));

      // Send real-time update
      await pusherServer.trigger(`org-${orgId}`, "run-updated", {
        runId,
        status: "scheduled",
        scheduledTime: scheduleDate.toISOString(),
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
              } as Partial<typeof runs.$inferInsert>)
              .where(eq(runs.id, runId))
              .then(() => {
                // Send error notification
                return pusherServer.trigger(`run-${runId}`, "run-error", {
                  runId,
                  error: err instanceof Error ? err.message : String(err),
                  time: new Date().toISOString(),
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

      // Clear any existing schedule
      this.clearScheduledRun(runId);

      // Get run details
      const [run] = await this.db
        .select()
        .from(runs)
        .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

      if (!run) {
        throw new Error(`Run ${runId} not found`);
      }

      if (run.status === "running") {
        console.log(`Run ${runId} is already running`);
        return;
      }

      // Check if the run has data to process
      const [{ value: rowCount }] = (await this.db
        .select({ value: sql`COUNT(*)` })
        .from(rows)
        .where(eq(rows.runId, runId))) as [{ value: number }];

      if (Number(rowCount) === 0) {
        console.warn(`Run ${runId} has no rows to process`);

        // Update run with warning
        await this.db
          .update(runs)
          .set({
            status: "failed",
            metadata: {
              ...run.metadata,
              run: {
                ...run.metadata?.run,
                error: "Run has no data to process",
                errorTime: new Date().toISOString(),
              },
            },
            updatedAt: new Date(),
          } as Partial<typeof runs.$inferInsert>)
          .where(eq(runs.id, runId));

        await pusherServer.trigger(`org-${orgId}`, "run-updated", {
          runId,
          status: "failed",
          error: "Run has no data to process",
        });

        return;
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
        } as Partial<typeof rows.$inferInsert>)
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
      const [{ count }] = (await this.db
        .select({
          count: sql`COUNT(*)`.mapWith(Number),
        })
        .from(rows)
        .where(
          and(
            eq(rows.runId, runId),
            sql`${rows.metadata}->>'statusReset' = 'true'`,
          ),
        )) as [{ count: number }];

      if (count > 0) {
        console.log(
          `Reset ${count} rows from 'calling' to 'pending' state for run ${runId}`,
        );
      }

      // Update run status to running with timestamp
      const startTime = new Date().toISOString();
      const updatedMetadata = {
        ...run.metadata,
        run: {
          ...(run.metadata?.run || {}),
          startTime: run.metadata?.run?.startTime || startTime,
          restartCount: ((run.metadata?.run as any)?.restartCount || 0) + 1,
          lastStartTime: startTime,
        },
      };

      await this.db
        .update(runs)
        .set({
          status: "running",
          metadata: updatedMetadata,
          updatedAt: new Date(),
        } as Partial<typeof runs.$inferInsert>)
        .where(eq(runs.id, runId));

      // Send real-time update
      await pusherServer.trigger(`org-${orgId}`, "run-updated", {
        runId,
        status: "running",
        metadata: updatedMetadata,
      });

      // Start processing the run
      this.processRun(runId, orgId).catch((err) => {
        console.error(`Error processing run ${runId}:`, err);
      });
    } catch (error) {
      console.error(`Error starting run ${runId}:`, error);

      // Try to update run status to failed
      try {
        await this.db
          .update(runs)
          .set({
            status: "failed",
            metadata: {
              run: {
                error: error instanceof Error ? error.message : String(error),
                errorTime: new Date().toISOString(),
              },
            },
            updatedAt: new Date(),
          } as Partial<typeof runs.$inferInsert>)
          .where(eq(runs.id, runId));

        await pusherServer.trigger(`org-${orgId}`, "run-updated", {
          runId,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      } catch (updateErr) {
        console.error(
          `Failed to update run ${runId} status to failed:`,
          updateErr,
        );
      }

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
      // Simplified atomic update - no transaction needed
      const updatedRows = await this.db
        .update(rows)
        .set({
          status: "calling",
          updatedAt: new Date(),
          metadata: {
            ...row.metadata,
            lastProcessAttempt: new Date().toISOString(),
            processorId: this.processorId,
            claimedAt: new Date().toISOString(),
          },
        } as Partial<typeof rows.$inferInsert>)
        .where(and(eq(rows.id, row.id), eq(rows.status, "pending")))
        .returning();

      if (!updatedRows || updatedRows.length === 0) {
        console.log(`Row ${row.id} is no longer pending, skipping`);
        return null;
      }

      return updatedRows[0];
    } catch (error) {
      console.error(`Failed to mark row ${row.id} as calling:`, error);
      return null;
    }
  }

  /**
   * Helper to create a NOT IN condition
   */
  notInArray(column: any, values: any[]) {
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
              metadata: {
                ...run.metadata,
                run: {
                  ...run.metadata?.run,
                  pausedOutsideHours: true,
                  lastPausedAt: new Date().toISOString(),
                },
              },
              updatedAt: new Date(),
            } as Partial<typeof runs.$inferInsert>)
            .where(eq(runs.id, runId));

          // Send Pusher event to notify about pause
          await pusherServer.trigger(`run-${runId}`, "run-paused", {
            runId,
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
          const [{ value: activeRowCount }] = (await this.db
            .select({
              value: sql`COUNT(*)`,
            })
            .from(rows)
            .where(
              and(
                eq(rows.runId, runId),
                or(eq(rows.status, "pending"), eq(rows.status, "calling")),
              ),
            )) as [{ value: number }];

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
        let successfulCalls = 0;
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
                    } as Partial<typeof rows.$inferInsert>)
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

            // Prepare variables for the call with improved merging
            const callVariables = {
              ...row.variables,
            };

            // Create call in Retell with enhanced context and error handling
            console.log(`Starting call to ${phone} for row ${row.id}`);
            const retellCall = await createPhoneCall({
              toNumber: String(phone),
              fromNumber: organization.phone || "",
              agentId: template.agentId,
              variables: callVariables,
              metadata: {
                runId,
                rowId: row.id,
                orgId,
                campaignId: campaign.id,
                patientId: row.patientId,
                timezone: organization.timezone || "America/New_York",
              },
            });

            // Update last call time for rate limiting
            this.lastCallTimes.set(runId, Date.now());

            if (!retellCall.ok || !retellCall.call_id) {
              throw new Error("No call ID returned from Retell");
            }

            console.log(`Retell call created with ID: ${retellCall.call_id}`);

            // Update row with call ID
            await this.db
              .update(rows)
              .set({
                retellCallId: retellCall.call_id,
                updatedAt: new Date(),
                callAttempts: (row.callAttempts || 0) + 1,
              } as Partial<typeof rows.$inferInsert>)
              .where(eq(rows.id, row.id));

            // Create call record with enhanced tracking
            const generatedCall = await this.db
              .insert(calls)
              .values({
                orgId,
                runId,
                rowId: row.id,
                patientId: row.patientId,
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
              } as typeof calls.$inferInsert)
              .returning({ id: calls.id });

            const callId = generatedCall[0].id;

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
              } as Partial<typeof runs.$inferInsert>)
              .where(eq(runs.id, runId));

            // Send real-time update via Pusher
            await pusherServer.trigger(`run-${runId}`, "call-started", {
              rowId: row.id,
              callId: callId,
              retellCallId: retellCall.call_id,
              variables: callVariables,
            });

            // Also send org-level notification
            await pusherServer.trigger(`org-${orgId}`, "call-started", {
              runId,
              rowId: row.id,
              callId: callId,
              retellCallId: retellCall.call_id,
            });

            console.log(
              `Call created successfully for row ${row.id} with ID ${callId} (Retell ID: ${retellCall.call_id})`,
            );

            // Track batch success for dynamic sizing
            successfulCalls++;
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
                  } as Partial<typeof rows.$inferInsert>)
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
                  } as Partial<typeof rows.$inferInsert>)
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
                  } as Partial<typeof rows.$inferInsert>)
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
          const successRate = successfulCalls / pendingRows.length;

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

        // Check for stuck rows every 3
        if (Date.now() - lastStuckRowCheck > 60000) {
          await this.checkForStuckRows(runId);
          lastStuckRowCheck = Date.now();
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
        } as Partial<typeof runs.$inferInsert>)
        .where(eq(runs.id, runId));

      // Send real-time update via Pusher
      await pusherServer.trigger(`org-${orgId}`, "run-updated", {
        runId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
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
        } as Partial<typeof runs.$inferInsert>)
        .where(eq(runs.id, runId));

      // Send real-time update
      await pusherServer.trigger(`org-${orgId}`, "run-updated", {
        runId,
        status: "completed",
        metadata: updatedMetadata,
      });

      console.log(`Run ${runId} marked as completed successfully`);
    } catch (error) {
      console.error(`Error completing run ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Increment a metric in run metadata
   */
  async incrementMetric(runId: string, metricPath: string): Promise<void> {
    try {
      // Get run
      const [run] = await this.db.select().from(runs).where(eq(runs.id, runId));

      if (!run) {
        throw new Error(`Run ${runId} not found`);
      }

      // Parse path (e.g., 'calls.completed')
      const parts = metricPath.split(".") as string[];

      // Create a deep copy of metadata to avoid mutation issues
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

      // Update run metadata with optimistic concurrency control
      const result = await this.db
        .update(runs)
        .set({
          metadata: metadata as any,
          updatedAt: new Date(),
        } as Partial<typeof runs.$inferInsert>)
        .where(
          and(
            eq(runs.id, runId),
            // Only update if the updated_at timestamp matches what we read
            eq(runs.updatedAt, run.updatedAt),
          ),
        )
        .returning({ updatedAt: runs.updatedAt });

      // If update failed due to concurrency, retry once with fresh data
      if (result.length === 0) {
        console.log(
          `Concurrency conflict when updating metric ${metricPath} for run ${runId}, retrying...`,
        );

        // Get fresh run data
        const [freshRun] = await this.db
          .select()
          .from(runs)
          .where(eq(runs.id, runId));

        if (!freshRun) {
          throw new Error(`Run ${runId} not found on retry`);
        }

        // Create a deep copy of fresh metadata
        const freshMetadata = JSON.parse(
          JSON.stringify(freshRun.metadata || {}),
        ) as Record<string, any>;

        // Navigate to the correct part of the object
        let freshCurrent: Record<string, any> = freshMetadata;

        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i] as string;
          if (!freshCurrent[part]) {
            freshCurrent[part] = {};
          }
          freshCurrent = freshCurrent[part] as Record<string, any>;
        }

        // Increment the metric
        const freshLastPart = parts[parts.length - 1] as string;
        freshCurrent[freshLastPart] =
          ((freshCurrent[freshLastPart] as number) || 0) + 1;

        // Update with fresh data
        await this.db
          .update(runs)
          .set({
            metadata: freshMetadata as any,
            updatedAt: new Date(),
          } as Partial<typeof runs.$inferInsert>)
          .where(eq(runs.id, runId));
      }

      // Send real-time update with debounce to avoid flooding
      const debounceKey = `${runId}-${metricPath}`;

      if (!this.metricUpdateTimeouts.has(debounceKey)) {
        this.metricUpdateTimeouts.set(
          debounceKey,
          setTimeout(async () => {
            this.metricUpdateTimeouts.delete(debounceKey);

            try {
              // Get latest run metadata for the update
              const [latestRun] = await this.db
                .select()
                .from(runs)
                .where(eq(runs.id, runId));

              if (latestRun) {
                await pusherServer.trigger(`run-${runId}`, "metrics-updated", {
                  runId,
                  metrics: latestRun.metadata,
                  metricPath,
                });
              }
            } catch (pusherError) {
              console.error(
                `Error sending metric update for ${runId}:`,
                pusherError,
              );
            }
          }, 1000), // Debounce for 1 second
        );
      }
    } catch (error) {
      console.error(
        `Error incrementing metric ${metricPath} for run ${runId}:`,
        error,
      );
      // Don't throw to avoid disrupting the call flow
    }
  }

  /**
   * Check for stuck rows and reset them
   */
  private async checkForStuckRows(runId: string): Promise<void> {
    try {
      console.log(`Checking for stuck rows in run ${runId}`);

      // Find rows that have been in "calling" state for more than 10 minutes
      const stuckRows = await this.db
        .select()
        .from(rows)
        .where(
          and(
            eq(rows.runId, runId),
            eq(rows.status, "calling"),
            // Check if updatedAt is more than 10 minutes ago
            sql`${rows.updatedAt} < NOW() - INTERVAL '10 minutes'`,
          ),
        );

      if (stuckRows.length > 0) {
        console.log(
          `Found ${stuckRows.length} rows stuck in "calling" state for run ${runId}`,
        );

        // Reset these rows to "pending" state
        for (const row of stuckRows) {
          await this.db
            .update(rows)
            .set({
              status: "pending",
              error: "Reset from stuck 'calling' state",
              updatedAt: new Date(),
              metadata: {
                ...row.metadata,
                stuckInCalling: true,
                resetTime: new Date().toISOString(),
              },
            } as Partial<typeof rows.$inferInsert>)
            .where(eq(rows.id, row.id));

          console.log(`Reset stuck row ${row.id} to "pending" state`);
        }
      }
    } catch (error) {
      console.error(`Error checking for stuck rows in run ${runId}:`, error);
    }
  }
}
