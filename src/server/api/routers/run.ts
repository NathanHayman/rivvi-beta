// src/server/api/routers/run.ts
import { CallProcessor } from "@/lib/call-processor";
import { processExcelFile } from "@/lib/excel-processor";
import { pusherServer } from "@/lib/pusher-server";
import { createTRPCRouter, orgProcedure } from "@/server/api/trpc";
import { calls, campaigns, rows, runs } from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

export const runRouter = createTRPCRouter({
  // Get all runs for a campaign
  getAll: orgProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { campaignId, limit, offset } = input;
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      const allRuns = await ctx.db
        .select()
        .from(runs)
        .where(and(eq(runs.campaignId, campaignId), eq(runs.orgId, orgId)))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(runs.createdAt));

      const totalCount = await ctx.db
        .select({ count: runs.id })
        .from(runs)
        .where(and(eq(runs.campaignId, campaignId), eq(runs.orgId, orgId)))
        .then((rows) => rows.length);

      return {
        runs: allRuns,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    }),

  // Get a run by ID
  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      const [run] = await ctx.db
        .select()
        .from(runs)
        .where(and(eq(runs.id, input.id), eq(runs.orgId, orgId)));

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Run not found",
        });
      }

      // Get the associated campaign
      const [campaign] = await ctx.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, run.campaignId));

      return { ...run, campaign };
    }),

  // Get rows for a run with pagination
  getRows: orgProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        page: z.number().min(1).optional().default(1),
        pageSize: z.number().min(1).max(100).optional().default(50),
        filter: z
          .enum(["all", "pending", "completed", "failed", "calling"])
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { runId, page, pageSize, filter } = input;
      const offset = (page - 1) * pageSize;
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Build base query
      let baseCondition = and(eq(rows.runId, runId), eq(rows.orgId, orgId));

      // Add status filter if specified
      if (filter && filter !== "all") {
        baseCondition = and(baseCondition, eq(rows.status, filter));
      }

      // Execute query with pagination
      const rowsData = await ctx.db
        .select()
        .from(rows)
        .where(baseCondition)
        .limit(pageSize)
        .offset(offset)
        .orderBy(rows.sortIndex);

      // Get total count with same filters
      const [{ value: totalCount }] = await ctx.db
        .select({ value: count() })
        .from(rows)
        .where(baseCondition)
        .then((rows) => rows as [{ value: number }]);

      // Get status counts for filters
      const statusCounts = await ctx.db
        .select({
          status: rows.status,
          count: count(),
        })
        .from(rows)
        .where(baseCondition)
        .groupBy(rows.status);

      const counts = {
        all: totalCount,
        pending: 0,
        calling: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      };

      statusCounts.forEach((item) => {
        counts[item.status] = Number(item.count);
      });

      return {
        rows: rowsData,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
        },
        counts,
      };
    }),

  // Create a new run
  create: orgProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        name: z.string().min(1),
        scheduledAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Verify the campaign exists and belongs to the organization
      const [campaign] = await ctx.db
        .select()
        .from(campaigns)
        .where(
          and(eq(campaigns.id, input.campaignId), eq(campaigns.orgId, orgId)),
        );

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      // Create empty metadata structure
      const metadata = {
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
        run: {},
      };

      // Create the run
      const [run] = await ctx.db
        .insert(runs)
        .values({
          campaignId: input.campaignId,
          orgId,
          name: input.name,
          status: "draft",
          metadata,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        })
        .returning();

      return run;
    }),

  // Upload and process file for a run
  uploadFile: orgProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        fileContent: z.string(),
        fileName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { runId, fileContent, fileName } = input;
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Get the run and associated campaign
      const [run] = await ctx.db
        .select()
        .from(runs)
        .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Run not found",
        });
      }

      // Get the campaign
      const [campaign] = await ctx.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, run.campaignId));

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      // Update run status to processing
      await ctx.db
        .update(runs)
        .set({ status: "processing" })
        .where(eq(runs.id, runId));

      try {
        // Process the Excel file
        const processedData = await processExcelFile(
          fileContent,
          fileName,
          campaign.config,
        );

        // Store the processed data as rows
        const rowsToInsert = processedData.validRows.map((rowData, index) => ({
          runId,
          orgId,
          variables: rowData.variables,
          patientId: rowData.patientId,
          status: "pending",
          sortIndex: index,
        }));

        if (rowsToInsert.length > 0) {
          await ctx.db.insert(rows).values(rowsToInsert as any);
        }

        // Update run metadata with results
        const updatedMetadata = {
          ...run.metadata,
          rows: {
            total: processedData.validRows.length,
            invalid: processedData.invalidRows.length,
          },
          calls: {
            ...run.metadata?.calls,
            total: processedData.validRows.length,
            pending: processedData.validRows.length,
          },
        };

        // Update run status and metadata
        await ctx.db
          .update(runs)
          .set({
            status: "ready",
            metadata: updatedMetadata as any,
            rawFileUrl: processedData.rawFileUrl,
            processedFileUrl: processedData.processedFileUrl,
          })
          .where(eq(runs.id, runId));

        // Send real-time update
        await pusherServer.trigger(`org-${orgId}`, "run-updated", {
          runId,
          status: "ready",
          metadata: updatedMetadata,
        });

        return {
          success: true,
          rowsAdded: processedData.validRows.length,
          invalidRows: processedData.invalidRows.length,
          errors: processedData.errors,
        };
      } catch (error) {
        // Update run status to failed
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        const updatedMetadata = {
          ...run.metadata,
          run: {
            ...run.metadata?.run,
            error: errorMessage,
          },
        };

        await ctx.db
          .update(runs)
          .set({
            status: "failed",
            metadata: updatedMetadata as any,
          })
          .where(eq(runs.id, runId));

        // Send real-time update
        await pusherServer.trigger(`org-${orgId}`, "run-updated", {
          runId,
          status: "failed",
          metadata: updatedMetadata,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to process file: ${errorMessage}`,
          cause: error,
        });
      }
    }),

  // Update a run's prompt
  updatePrompt: orgProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        customPrompt: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { runId, customPrompt } = input;
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      const [run] = await ctx.db
        .update(runs)
        .set({ customPrompt })
        .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)))
        .returning();

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Run not found",
        });
      }

      return run;
    }),

  // Schedule a run
  schedule: orgProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        scheduledAt: z.string().datetime(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { runId, scheduledAt } = input;
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      const [run] = await ctx.db
        .update(runs)
        .set({
          scheduledAt: new Date(scheduledAt),
          status: "scheduled",
        })
        .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)))
        .returning();

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Run not found",
        });
      }

      // Update metadata
      const updatedMetadata = {
        ...run.metadata,
        run: {
          ...run.metadata?.run,
          scheduledTime: scheduledAt,
        },
      };

      await ctx.db
        .update(runs)
        .set({ metadata: updatedMetadata as any })
        .where(eq(runs.id, runId));

      // Send real-time update
      await pusherServer.trigger(`org-${orgId}`, "run-updated", {
        runId,
        status: "scheduled",
        metadata: updatedMetadata,
      });

      return run;
    }),

  // Start a run
  start: orgProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { runId } = input;
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Get the run
      const [run] = await ctx.db
        .select()
        .from(runs)
        .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Run not found",
        });
      }

      // Check if run can be started
      if (
        run.status !== "ready" &&
        run.status !== "paused" &&
        run.status !== "scheduled"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Run cannot be started from ${run.status} status`,
        });
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

      await ctx.db
        .update(runs)
        .set({
          status: "running",
          metadata: updatedMetadata as any,
        })
        .where(eq(runs.id, runId));

      // Send real-time update
      await pusherServer.trigger(`org-${orgId}`, "run-updated", {
        runId,
        status: "running",
        metadata: updatedMetadata,
      });

      // Start call processing
      const callProcessor = new CallProcessor(ctx.db);
      void callProcessor.processRun(runId, orgId);

      return { success: true, status: "running" };
    }),

  // Pause a run
  pause: orgProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { runId } = input;
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Get the run
      const [run] = await ctx.db
        .select()
        .from(runs)
        .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Run not found",
        });
      }

      // Check if run can be paused
      if (run.status !== "running") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only running runs can be paused",
        });
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

      await ctx.db
        .update(runs)
        .set({
          status: "paused",
          metadata: updatedMetadata as any,
        })
        .where(eq(runs.id, runId));

      // Send real-time update
      await pusherServer.trigger(`org-${orgId}`, "run-updated", {
        runId,
        status: "paused",
        metadata: updatedMetadata,
      });

      return { success: true, status: "paused" };
    }),

  // Get run statistics
  getStats: orgProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { runId } = input;
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Get the run
      const [run] = await ctx.db
        .select()
        .from(runs)
        .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Run not found",
        });
      }

      // Get row statistics
      const rowStats = await ctx.db
        .select({
          status: rows.status,
          count: count(),
        })
        .from(rows)
        .where(eq(rows.runId, runId))
        .groupBy(rows.status);

      // Get call statistics
      const callStats = await ctx.db
        .select({
          status: calls.status,
          count: count(),
        })
        .from(calls)
        .where(eq(calls.runId, runId))
        .groupBy(calls.status);

      return {
        metadata: run.metadata,
        rowStats,
        callStats,
      };
    }),
});
