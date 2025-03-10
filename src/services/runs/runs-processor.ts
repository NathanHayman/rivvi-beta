// src/services/runs/runs-processor.ts
import { triggerEvent } from "@/lib/pusher-server";
import {
  calls,
  campaignTemplates,
  campaigns,
  organizationPatients,
  organizations,
  patients,
  rows,
  runs,
} from "@/server/db/schema";
import { and, count, eq, lt, or, sql } from "drizzle-orm";

export class RunsProcessor {
  private db;

  constructor(db) {
    this.db = db;
  }

  /**
   * Process a run by making calls for all pending rows
   */
  async processRun(runId: string, orgId: string): Promise<void> {
    try {
      console.log(`Starting call processing for run ${runId}`);

      // Get the run
      const [run] = await this.db
        .select()
        .from(runs)
        .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

      if (!run) {
        console.error(`Run ${runId} not found or not accessible`);
        return;
      }

      // Verify run is in the right state
      if (run.status !== "running") {
        console.log(`Run ${runId} is not in running state (${run.status})`);
        return;
      }

      // Get organization phone number
      const [organization] = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      if (!organization || !organization.phone) {
        console.error(`Organization ${orgId} not found or has no phone number`);
        await this.pauseRunWithError(
          runId,
          orgId,
          "No organization phone number",
        );
        return;
      }

      // Get the campaign and template
      const [campaign] = await this.db
        .select({
          campaign: campaigns,
          template: campaignTemplates,
        })
        .from(campaigns)
        .leftJoin(
          campaignTemplates,
          eq(campaigns.templateId, campaignTemplates.id),
        )
        .where(eq(campaigns.id, run.campaignId));

      if (!campaign) {
        console.error(`Campaign for run ${runId} not found`);
        await this.pauseRunWithError(runId, orgId, "Campaign not found");
        return;
      }

      // Get run configuration from metadata
      const batchSize = run.metadata?.run?.batchSize || 10;
      const callsPerMinute = run.metadata?.run?.callsPerMinute || 10;
      const maxRetries = run.metadata?.run?.maxRetries || 2;

      // Calculate delay between calls
      const delayMs = 60000 / callsPerMinute;

      // Process rows in small batches
      await this.processBatch(
        runId,
        orgId,
        batchSize,
        delayMs,
        organization.phone,
        campaign.template?.agentId || "",
        maxRetries,
      );

      console.log(`Completed call processing for run ${runId}`);
    } catch (error) {
      console.error(`Error processing run ${runId}:`, error);

      // Pause the run due to error
      await this.pauseRunWithError(
        runId,
        orgId,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Process a batch of rows from a run
   */
  private async processBatch(
    runId: string,
    orgId: string,
    batchSize: number,
    delayMs: number,
    fromNumber: string,
    agentId: string,
    maxRetries: number,
  ): Promise<void> {
    // Get pending rows for this run
    const pendingRows = await this.db
      .select()
      .from(rows)
      .where(
        and(
          eq(rows.runId, runId),
          eq(rows.status, "pending"),
          eq(rows.orgId, orgId),
          lt(rows.retryCount, maxRetries),
        ),
      )
      .limit(batchSize)
      .orderBy(rows.sortIndex);

    if (pendingRows.length === 0) {
      console.log(`No pending rows for run ${runId}, checking if complete`);

      // Check if all rows are processed (not pending or calling)
      const [{ count: activeRowsCount }] = await this.db
        .select({ count: count() })
        .from(rows)
        .where(
          and(
            eq(rows.runId, runId),
            or(eq(rows.status, "pending"), eq(rows.status, "calling")),
          ),
        );

      // If no active rows, mark run as completed
      if (Number(activeRowsCount) === 0) {
        await this.completeRun(runId, orgId);
      }

      return;
    }

    console.log(`Processing ${pendingRows.length} rows for run ${runId}`);

    // Process each row sequentially with delay
    for (const row of pendingRows) {
      // Check if run is still running
      const [currentRun] = await this.db
        .select({ status: runs.status })
        .from(runs)
        .where(eq(runs.id, runId));

      if (!currentRun || currentRun.status !== "running") {
        console.log(`Run ${runId} is no longer running, stopping batch`);
        return;
      }

      try {
        // Mark row as calling and increment retry count
        await this.db
          .update(rows)
          .set({
            status: "calling",
            retryCount: sql`${rows.retryCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(rows.id, row.id));

        // Process patient data if available
        let patientId = row.patientId;
        let toNumber = row.variables?.phone || "";

        if (!patientId && row.variables) {
          const patientResult = await this.findOrCreatePatient(
            row.variables,
            orgId,
          );

          if (patientResult.success) {
            patientId = patientResult.patientId;
            toNumber = patientResult.phone;

            // Update row with patient ID
            await this.db
              .update(rows)
              .set({ patientId })
              .where(eq(rows.id, row.id));
          }
        }

        if (!toNumber) {
          console.error(`No phone number for row ${row.id}`);
          await this.markRowFailed(row.id, "No phone number");
          continue;
        }

        // Create the call
        const call = await this.createCall(
          runId,
          orgId,
          row.id,
          patientId,
          fromNumber,
          toNumber,
          agentId,
          row.variables,
        );

        if (!call) {
          await this.markRowFailed(row.id, "Failed to create call");
          continue;
        }

        // Trigger event for call started
        await triggerEvent(`run-${runId}`, "call-started", {
          rowId: row.id,
          callId: call.id,
          variables: row.variables,
        });

        // Delay before next call
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } catch (error) {
        console.error(`Error processing row ${row.id}:`, error);
        await this.markRowFailed(
          row.id,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }

    // Process next batch
    await this.processBatch(
      runId,
      orgId,
      batchSize,
      delayMs,
      fromNumber,
      agentId,
      maxRetries,
    );
  }

  /**
   * Find or create a patient from row variables
   */
  private async findOrCreatePatient(
    variables: Record<string, any>,
    orgId: string,
  ): Promise<{
    success: boolean;
    patientId?: string;
    phone?: string;
  }> {
    try {
      // Extract patient fields from variables
      const firstName = variables.first_name || variables.firstName || "";
      const lastName = variables.last_name || variables.lastName || "";
      const phone = variables.phone || variables.phoneNumber || "";
      const dob = variables.dob || variables.dateOfBirth || null;

      if (!firstName || !lastName || !phone) {
        return { success: false };
      }

      // Look for existing patient by phone
      const [existingPatient] = await this.db
        .select()
        .from(patients)
        .where(eq(patients.primaryPhone, phone))
        .limit(1);

      if (existingPatient) {
        // Check if linked to organization
        const [link] = await this.db
          .select()
          .from(organizationPatients)
          .where(
            and(
              eq(organizationPatients.patientId, existingPatient.id),
              eq(organizationPatients.orgId, orgId),
            ),
          )
          .limit(1);

        if (!link) {
          // Create link
          await this.db.insert(organizationPatients).values({
            orgId,
            patientId: existingPatient.id,
            isActive: true,
          });
        }

        return {
          success: true,
          patientId: existingPatient.id,
          phone: existingPatient.primaryPhone,
        };
      }

      // Create new patient hash
      let patientHash = "";
      if (firstName && lastName && phone) {
        const dobString = dob
          ? new Date(dob).toISOString().split("T")[0]
          : "unknown-dob";

        patientHash = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${dobString}|${phone.replace(/\D/g, "")}`;
      }

      // Insert new patient
      const [newPatient] = await this.db
        .insert(patients)
        .values({
          firstName,
          lastName,
          primaryPhone: phone,
          dob: dob ? new Date(dob) : null,
          patientHash,
          isMinor: false, // Default value, can be updated later
        })
        .returning();

      if (!newPatient) {
        return { success: false };
      }

      // Link to organization
      await this.db.insert(organizationPatients).values({
        orgId,
        patientId: newPatient.id,
        isActive: true,
      });

      return {
        success: true,
        patientId: newPatient.id,
        phone: newPatient.primaryPhone,
      };
    } catch (error) {
      console.error("Error finding/creating patient:", error);
      return { success: false };
    }
  }

  /**
   * Create a call record and make the call
   */
  private async createCall(
    runId: string,
    orgId: string,
    rowId: string,
    patientId: string | null,
    fromNumber: string,
    toNumber: string,
    agentId: string,
    variables: Record<string, any> = {},
  ): Promise<typeof calls.$inferSelect | null> {
    try {
      // Get campaign ID from run
      const [run] = await this.db
        .select({ campaignId: runs.campaignId })
        .from(runs)
        .where(eq(runs.id, runId));

      if (!run) {
        return null;
      }

      // Create Retell call
      const retellCall = await retellClient.createPhoneCall({
        toNumber,
        fromNumber,
        agentId,
        variables,
        metadata: {
          orgId,
          runId,
          rowId,
          patientId,
          campaignId: run.campaignId,
        },
      });

      if (!retellCall.ok || !retellCall.call_id) {
        console.error(
          `Failed to create Retell call: ${retellCall.error || "Unknown error"}`,
        );
        return null;
      }

      // Create call record in database
      const [call] = await this.db
        .insert(calls)
        .values({
          orgId,
          runId,
          rowId,
          patientId,
          campaignId: run.campaignId,
          agentId,
          direction: "outbound",
          status: "pending",
          retellCallId: retellCall.call_id,
          toNumber,
          fromNumber,
          metadata: {
            variables,
          },
        })
        .returning();

      if (!call) {
        console.error("Failed to create call record in database");
        return null;
      }

      // Trigger organization-level call event
      await triggerEvent(`org-${orgId}`, "call-started", {
        runId,
        rowId,
        callId: call.id,
      });

      return call;
    } catch (error) {
      console.error("Error creating call:", error);
      return null;
    }
  }

  /**
   * Mark a row as failed
   */
  private async markRowFailed(rowId: string, error: string): Promise<void> {
    try {
      await this.db
        .update(rows)
        .set({
          status: "failed",
          error,
          updatedAt: new Date(),
        })
        .where(eq(rows.id, rowId));
    } catch (error) {
      console.error(`Error marking row ${rowId} as failed:`, error);
    }
  }

  /**
   * Pause a run with error
   */
  private async pauseRunWithError(
    runId: string,
    orgId: string,
    error: string,
  ): Promise<void> {
    try {
      // Update run status
      await this.db
        .update(runs)
        .set({
          status: "paused",
          metadata: sql`jsonb_set(${runs.metadata}::jsonb, '{run,error}', ${sql.raw(`'${error}'::jsonb`)})`,
          updatedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      // Trigger events
      const pausedAt = new Date().toISOString();

      await Promise.all([
        // Update run status event
        triggerEvent(`org-${orgId}`, "run-updated", {
          runId,
          status: "paused",
          metadata: {
            run: {
              error,
              lastPausedAt: pausedAt,
            },
          },
        }),

        // Dedicated run pause event
        triggerEvent(`run-${runId}`, "run-paused", {
          reason: error,
          pausedAt,
        }),
      ]);
    } catch (error) {
      console.error(`Error pausing run ${runId}:`, error);
    }
  }

  /**
   * Complete a run
   */
  private async completeRun(runId: string, orgId: string): Promise<void> {
    try {
      // Update run status
      await this.db
        .update(runs)
        .set({
          status: "completed",
          metadata: sql`jsonb_set(
            ${runs.metadata}::jsonb, 
            '{run,endTime}', 
            ${sql.raw(`'"${new Date().toISOString()}"'::jsonb`)}
          )`,
          updatedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      // Trigger events
      await triggerEvent(`org-${orgId}`, "run-updated", {
        runId,
        status: "completed",
        metadata: {
          run: {
            endTime: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error(`Error completing run ${runId}:`, error);
    }
  }
}
