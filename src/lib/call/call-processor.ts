// src/lib/call-processor.ts
import {
  calls,
  campaigns,
  organizations,
  rows,
  runs,
} from "@/server/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { toZonedTime } from "date-fns-tz";
import { and, asc, desc, eq, lt, or, sql } from "drizzle-orm";
import { pusherServer } from "./pusher-server";
import { createPhoneCall } from "./retell-client";

type DatabaseClient = typeof import("@/server/db").db;

export class CallProcessor {
  private db: DatabaseClient;
  private processingRuns: Set<string> = new Set();
  private scheduledRuns: Map<string, NodeJS.Timeout> = new Map();

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  /**
   * Schedule a run for execution
   * @param runId The run ID to schedule
   * @param scheduleTime The time to schedule the run (ISO string)
   * @param orgId The organization ID
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

      // Update run status to scheduled
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
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      // Send real-time update
      await pusherServer.trigger(`org-${orgId}`, "run-updated", {
        runId,
        status: "scheduled",
        scheduledTime: scheduleDate.toISOString(),
      });

      // Schedule the run
      const timeout = setTimeout(() => {
        this.startRun(runId, orgId).catch((err) => {
          console.error(`Error starting scheduled run ${runId}:`, err);
        });
      }, delay);

      // Store the timeout for potential cancellation
      this.scheduledRuns.set(runId, timeout);
    } catch (error) {
      console.error(`Error scheduling run ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Clear a scheduled run
   * @param runId The run ID to clear
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
   * @param runId The run ID to start
   * @param orgId The organization ID
   */
  async startRun(runId: string, orgId: string): Promise<void> {
    try {
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

      // Update run status to running
      await this.db
        .update(runs)
        .set({
          status: "running",
          updatedAt: new Date(),
          metadata: {
            rows: run.metadata?.rows || { total: 0, invalid: 0 },
            calls: run.metadata?.calls || {
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
              ...run.metadata?.run,
              startTime: new Date().toISOString(),
            },
          },
        })
        .where(eq(runs.id, runId));

      // Send real-time update
      await pusherServer.trigger(`org-${orgId}`, "run-updated", {
        runId,
        status: "running",
      });

      // Start processing the run
      this.processRun(runId, orgId).catch((err) => {
        console.error(`Error processing run ${runId}:`, err);
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
   * @param orgId The organization ID
   * @returns Whether the current time is within office hours
   */
  async isWithinOfficeHours(orgId: string): Promise<boolean> {
    try {
      // Get organization details
      const [org] = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (!org || !org.timezone || !org.officeHours) {
        // If not configured, default to true
        return true;
      }

      const timezone = org.timezone;
      const officeHours = org.officeHours as {
        weekdays?: { start: string; end: string }[];
        weekend?: { start: string; end: string }[];
      };

      // Convert current time to organization's timezone
      const now = new Date();
      const zonedNow = toZonedTime(now, timezone);

      // Get day of week (0 = Sunday, 6 = Saturday)
      const dayOfWeek = zonedNow.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Get current time as hours and minutes
      const hours = zonedNow.getHours();
      const minutes = zonedNow.getMinutes();
      const currentTime = hours * 60 + minutes; // Convert to minutes since midnight

      // Check if current time is within office hours
      const hoursConfig = isWeekend
        ? officeHours.weekend
        : officeHours.weekdays;

      if (!hoursConfig || hoursConfig.length === 0) {
        // No hours configured for this day
        return !isWeekend; // Default to allowing weekdays, blocking weekends
      }

      for (const range of hoursConfig) {
        const [startHours, startMinutes] = range.start.split(":").map(Number);
        const [endHours, endMinutes] = range.end.split(":").map(Number);

        const startTime = startHours
          ? startHours * 60 + (startMinutes || 0)
          : 0;
        const endTime = endHours ? endHours * 60 + (endMinutes || 0) : 24 * 60;

        if (currentTime >= startTime && currentTime <= endTime) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error(`Error checking office hours for org ${orgId}:`, error);
      return true; // Default to true on error
    }
  }

  /**
   * Process a run's calls in batches with improved timezone-aware scheduling
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
        // Get run details with all relevant data
        const [run] = await this.db
          .select()
          .from(runs)
          .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

        currentRun = run;

        if (!run || run.status !== "running") {
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
                rows: run.metadata?.rows || { total: 0, invalid: 0 },
                calls: run.metadata?.calls || {
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
                  ...run.metadata?.run,
                  pausedOutsideHours: true,
                  lastPausedAt: new Date().toISOString(),
                },
              },
              updatedAt: new Date(),
            })
            .where(eq(runs.id, runId));

          // Wait before checking again (30 minutes)
          await new Promise((resolve) => setTimeout(resolve, 30 * 60 * 1000));
          continue;
        }

        // Get organization for concurrency and settings
        const [organization] = await this.db
          .select()
          .from(organizations)
          .where(eq(organizations.id, orgId));

        if (!organization) {
          throw new Error(`Organization ${orgId} not found`);
        }

        // Get campaign for agent ID and configuration
        const [campaign] = await this.db
          .select()
          .from(campaigns)
          .where(eq(campaigns.id, run.campaignId));

        if (!campaign) {
          throw new Error(`Campaign ${run.campaignId} not found`);
        }

        // Check concurrency limits
        const concurrencyLimit = organization.concurrentCallLimit || 20;

        // Count active calls (both for this run and total for the org)
        const [{ value: activeCalls }] = (await this.db
          .select({
            value: sql`COUNT(*)`.mapWith(Number),
          })
          .from(calls)
          .where(
            and(
              eq(calls.runId, runId),
              or(eq(calls.status, "in-progress"), eq(calls.status, "pending")),
            ),
          )) as [{ value: number }];

        // Count total org active calls (to respect org-wide limits)
        const [{ value: orgActiveCalls }] = (await this.db
          .select({
            value: sql`COUNT(*)`.mapWith(Number),
          })
          .from(calls)
          .where(
            and(
              eq(calls.orgId, orgId),
              or(eq(calls.status, "in-progress"), eq(calls.status, "pending")),
            ),
          )) as [{ value: number }];

        const availableSlots = Math.min(
          concurrencyLimit - Number(orgActiveCalls),
          concurrencyLimit - Number(activeCalls),
        );

        if (availableSlots <= 0) {
          console.log(`No available call slots for run ${runId}, waiting...`);
          // No available slots, wait before checking again
          await new Promise((resolve) => setTimeout(resolve, 10000));
          continue;
        }

        // Get run configuration for batching
        const batchSize = Math.min(
          availableSlots,
          (run.metadata?.run?.batchSize as number) || 10,
        );

        // Respect rate limits to avoid overwhelming the call center
        const callsPerMinute =
          (run.metadata?.run?.callsPerMinute as number) || 10;
        const delayBetweenCalls = Math.max(
          1000,
          Math.floor(60000 / callsPerMinute),
        );

        // Get next batch of pending rows with priority ordering
        const pendingRows = await this.db
          .select()
          .from(rows)
          .where(and(eq(rows.runId, runId), eq(rows.status, "pending")))
          .orderBy(
            // First by priority if available
            desc(sql`COALESCE((${rows.variables}->>'priority')::int, 0)`),
            // Then by sort index
            asc(rows.sortIndex),
          )
          .limit(batchSize);

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
          // Skip if no longer within office hours
          if (!(await this.isWithinOfficeHours(orgId))) {
            console.log(
              `Stopping batch: outside of office hours for org ${orgId}`,
            );
            break;
          }

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

                  continue;
                }
              } catch (error) {
                console.error(`Error checking timezone for ${phone}:`, error);
                // Continue with call if timezone check fails
              }
            }

            // Create call in Retell with enhanced context
            const retellCall = await createPhoneCall({
              toNumber: String(phone),
              fromNumber: organization.phone || "",
              agentId: campaign.agentId,
              variables: {
                ...row.variables,
                custom_prompt: run.customPrompt || undefined,
                organization_name: organization.name,
                campaign_name: campaign.name,
                retry_count: row.retryCount || 0,
              },
              metadata: {
                runId,
                rowId: row.id,
                orgId,
                campaignId: campaign.id,
                patientId: row.patientId,
                timezone: organization.timezone || "America/New_York",
              },
            });

            if (!retellCall.call_id) {
              throw new Error("No call ID returned from Retell");
            }

            // Update row with call ID
            await this.db
              .update(rows)
              .set({
                retellCallId: retellCall.call_id,
                updatedAt: new Date(),
                callAttempts: (row.callAttempts || 0) + 1,
              })
              .where(eq(rows.id, row.id));

            // Create call record with enhanced tracking
            await this.db.insert(calls).values({
              id: createId(),
              orgId,
              runId,
              rowId: row.id,
              patientId: row.patientId,
              agentId: campaign.agentId,
              campaignId: campaign.id,
              direction: "outbound",
              status: "pending",
              retellCallId: retellCall.call_id,
              toNumber: String(phone),
              fromNumber: organization.phone || "",
              metadata: {
                variables: row.variables,
                attempt: (row.callAttempts || 0) + 1,
                rowMetadata: row.metadata,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            // Update run metrics
            await this.incrementMetric(runId, "calls.calling");

            // Update timestamps for analytics
            await this.db
              .update(runs)
              .set({
                metadata: {
                  rows: run.metadata?.rows || { total: 0, invalid: 0 },
                  calls: run.metadata?.calls || {
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
                    ...run.metadata?.run,
                    lastCallTime: new Date().toISOString(),
                  },
                },
                updatedAt: new Date(),
              })
              .where(eq(runs.id, runId));

            // Send real-time update
            await pusherServer.trigger(`run-${runId}`, "call-started", {
              rowId: row.id,
              callId: retellCall.call_id,
              variables: row.variables,
            });

            // Also send org-level notification
            await pusherServer.trigger(`org-${orgId}`, "call-started", {
              runId,
              rowId: row.id,
              callId: retellCall.call_id,
            });
          } catch (error) {
            console.error(`Error dispatching call for row ${row.id}:`, error);

            // Determine if we should retry
            const maxRetries = (run.metadata?.run?.maxRetries as number) || 3;
            const currentRetries = row.retryCount || 0;

            if (currentRetries < maxRetries) {
              // Mark for retry
              await this.db
                .update(rows)
                .set({
                  status: "pending",
                  retryCount: currentRetries + 1,
                  error: error instanceof Error ? error.message : String(error),
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
                  status: "failed",
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
          }

          // Delay between calls to respect rate limits
          await new Promise((resolve) =>
            setTimeout(resolve, delayBetweenCalls),
          );
        }

        // Wait before processing next batch (avoid API rate limits and throttling)
        const batchDelay = Math.max(
          5000,
          Math.floor((60000 / callsPerMinute) * batchSize),
        );
        await new Promise((resolve) => setTimeout(resolve, batchDelay));
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
