// src/services/runs/runs-service.ts
import { triggerEvent } from "@/lib/pusher-server";
import {
  createError,
  createSuccess,
  ServiceResult,
} from "@/lib/service-result";
import { type TGetRuns } from "@/lib/validation/runs";
import { db } from "@/server/db";
import { campaigns, campaignTemplates, runs } from "@/server/db/schema";
import { RunResponse, RunWithCampaign } from "@/types/api/runs";
import { and, count, desc, eq } from "drizzle-orm";
import { RunsProcessor } from "./runs-processor";

export const runService = {
  async getAll(options: TGetRuns): Promise<ServiceResult<RunResponse>> {
    try {
      const { campaignId, orgId, limit = 20, offset = 0 } = options;

      // Get all runs for the campaign
      const allRuns = await db
        .select()
        .from(runs)
        .where(and(eq(runs.campaignId, campaignId), eq(runs.orgId, orgId)))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(runs.createdAt));

      // Get total count
      const [{ value: totalCount }] = await db
        .select({ value: count() })
        .from(runs)
        .where(and(eq(runs.campaignId, campaignId), eq(runs.orgId, orgId)));

      // Format the runs to match the expected type
      const formattedRuns = allRuns.map((run) => ({
        ...run,
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt?.toISOString(),
        scheduledAt: run.scheduledAt?.toISOString(),
      }));

      return createSuccess({
        runs: formattedRuns,
        totalCount: Number(totalCount),
        hasMore: offset + limit < Number(totalCount),
      });
    } catch (error) {
      console.error("Error fetching runs:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch runs", error);
    }
  },

  async getById(
    id: string,
    orgId: string,
  ): Promise<ServiceResult<RunWithCampaign>> {
    try {
      // Get the run with campaign and template
      const [run] = await db
        .select()
        .from(runs)
        .where(and(eq(runs.id, id), eq(runs.orgId, orgId)));

      if (!run) {
        return createError("NOT_FOUND", "Run not found");
      }

      // Get the associated campaign
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, run.campaignId));

      if (!campaign) {
        return createError("NOT_FOUND", "Campaign not found");
      }

      // Get the template
      const [template] = await db
        .select()
        .from(campaignTemplates)
        .where(eq(campaignTemplates.id, campaign.templateId));

      // Format dates to match the expected type
      const formattedRun = {
        ...run,
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt?.toISOString(),
        scheduledAt: run.scheduledAt?.toISOString(),
      };

      return createSuccess({
        ...formattedRun,
        campaign: {
          ...campaign,
          config: {
            basePrompt: template?.basePrompt || "",
            voicemailMessage: template?.voicemailMessage,
            variables: template?.variablesConfig,
            analysis: template?.analysisConfig,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching run:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch run", error);
    }
  },

  async start(
    runId: string,
    orgId: string,
  ): Promise<ServiceResult<{ success: true; status: string }>> {
    try {
      // Get the run
      const [run] = await db
        .select()
        .from(runs)
        .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

      if (!run) {
        return createError("NOT_FOUND", "Run not found");
      }

      // Check if run can be started
      if (
        run.status !== "ready" &&
        run.status !== "paused" &&
        run.status !== "scheduled"
      ) {
        return createError(
          "BAD_REQUEST",
          `Run cannot be started from ${run.status} status`,
        );
      }

      // Update run status to running
      const startTime = new Date().toISOString();
      const updatedMetadata = {
        ...run.metadata,
        run: {
          ...run.metadata?.run,
          startTime: run.metadata?.run?.startTime || startTime,
        },
      };

      await db
        .update(runs)
        .set({
          status: "running",
          metadata: updatedMetadata,
        } as Partial<typeof runs.$inferInsert>)
        .where(eq(runs.id, runId));

      // Send real-time update
      await triggerEvent(`org-${orgId}`, "run-updated", {
        runId,
        status: "running",
        metadata: updatedMetadata,
      });

      // Start call processing (asynchronously)
      const runsProcessor = new RunsProcessor(db);
      void runsProcessor.processRun(runId, orgId);

      return createSuccess({ success: true, status: "running" });
    } catch (error) {
      console.error("Error starting run:", error);
      return createError("INTERNAL_ERROR", "Failed to start run", error);
    }
  },

  async pause(
    runId: string,
    orgId: string,
  ): Promise<ServiceResult<{ success: true; status: string }>> {
    try {
      // Get the run
      const [run] = await db
        .select()
        .from(runs)
        .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

      if (!run) {
        return createError("NOT_FOUND", "Run not found");
      }

      // Check if run can be paused
      if (run.status !== "running") {
        return createError("BAD_REQUEST", "Only running runs can be paused");
      }

      // Update run status to paused
      const pausedAt = new Date().toISOString();
      const updatedMetadata = {
        ...run.metadata,
        run: {
          ...run.metadata?.run,
          lastPausedAt: pausedAt,
        },
      };

      await db
        .update(runs)
        .set({
          status: "paused",
          metadata: updatedMetadata,
        } as Partial<typeof runs.$inferInsert>)
        .where(eq(runs.id, runId));

      // Send real-time update
      await triggerEvent(`org-${orgId}`, "run-updated", {
        runId,
        status: "paused",
        metadata: updatedMetadata,
      });

      // Also send event to run-specific channel
      await triggerEvent(`run-${runId}`, "run-paused", {
        reason: "User paused run",
        pausedAt,
      });

      return createSuccess({ success: true, status: "paused" });
    } catch (error) {
      console.error("Error pausing run:", error);
      return createError("INTERNAL_ERROR", "Failed to pause run", error);
    }
  },

  async createRun(data: {
    name: string;
    campaignId: string;
    orgId: string;
    customPrompt?: string;
    customVoicemailMessage?: string;
    scheduledAt?: string;
    metadata?: Record<string, any>;
  }): Promise<ServiceResult<typeof runs.$inferSelect>> {
    try {
      const {
        name,
        campaignId,
        orgId,
        customPrompt,
        customVoicemailMessage,
        scheduledAt,
        metadata = {},
      } = data;

      // Verify the campaign exists and belongs to the organization
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.orgId, orgId)));

      if (!campaign) {
        return createError("NOT_FOUND", "Campaign not found");
      }

      // Create empty metadata structure
      const runMetadata = {
        rows: {
          total: 0,
          invalid: 0,
        },
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
          createdAt: new Date().toISOString(),
        },
        ...metadata,
      };

      // Create the run
      const [run] = await db
        .insert(runs)
        .values({
          campaignId,
          orgId,
          name,
          status: "draft",
          customPrompt,
          customVoicemailMessage,
          metadata: runMetadata,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        } as typeof runs.$inferInsert)
        .returning();

      if (!run) {
        return createError("INTERNAL_ERROR", "Failed to create run");
      }

      return createSuccess(run);
    } catch (error) {
      console.error("Error creating run:", error);
      return createError("INTERNAL_ERROR", "Failed to create run", error);
    }
  },
};
