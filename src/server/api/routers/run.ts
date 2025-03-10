// // src/server/api/routers/run.ts
// import { pusherServer } from "@/lib/pusher-server";
// import { createTRPCRouter, orgProcedure } from "@/server/api/trpc";
// import {
//   calls,
//   campaigns,
//   campaignTemplates,
//   rows,
//   runs,
// } from "@/server/db/schema";
// import { CallProcessor } from "@/services/out/call";
// import { parseFileContent, processExcelFile } from "@/services/out/file";
// import { TCampaignTemplate } from "@/types/db";
// import { TRPCError } from "@trpc/server";
// import { and, count, desc, eq, sql } from "drizzle-orm";
// import { revalidatePath } from "next/cache";
// import { z } from "zod";

// // Helper function to get campaign template
// async function getCampaignTemplate(db: any, campaignId: string) {
//   // Get campaign first
//   const [campaign] = await db
//     .select()
//     .from(campaigns)
//     .where(eq(campaigns.id, campaignId));

//   if (!campaign) {
//     throw new TRPCError({
//       code: "NOT_FOUND",
//       message: "Campaign not found",
//     });
//   }

//   // Get the associated template
//   const [template] = (await db
//     .select()
//     .from(campaignTemplates)
//     .where(eq(campaignTemplates.id, campaign.templateId))) as [
//     TCampaignTemplate,
//   ];

//   if (!template) {
//     throw new TRPCError({
//       code: "NOT_FOUND",
//       message: "Campaign template not found",
//     });
//   }

//   // Create a compatibility layer with better error handling
//   const configObject = {
//     basePrompt: template.basePrompt || "",
//     voicemailMessage: template.voicemailMessage || "",
//     variables: template.variablesConfig || {
//       patient: {
//         fields: [],
//         validation: {
//           requireValidPhone: true,
//           requireValidDOB: true,
//           requireName: true,
//         },
//       },
//       campaign: { fields: [] },
//     },
//     analysis: template.analysisConfig || {
//       standard: { fields: [] },
//       campaign: { fields: [] },
//     },
//   };

//   console.log(
//     "Template config structure:",
//     JSON.stringify(
//       {
//         hasBasePrompt: !!template.basePrompt,
//         hasVoicemailMessage: !!template.voicemailMessage,
//         hasVariablesConfig: !!template.variablesConfig,
//         hasAnalysisConfig: !!template.analysisConfig,
//       },
//       null,
//       2,
//     ),
//   );

//   // Log the detailed config structure
//   console.log(
//     "Generated config object:",
//     JSON.stringify(configObject, null, 2),
//   );

//   return {
//     campaign,
//     template,
//     // Create a compatibility layer for the old config format with fallbacks
//     campaignWithConfig: {
//       ...campaign,
//       config: configObject,
//     },
//   };
// }

// export const runRouter = createTRPCRouter({
//   // Get all runs for a campaign
//   getAll: orgProcedure
//     .input(
//       z.object({
//         campaignId: z.string().uuid(),
//         limit: z.number().min(1).max(100).optional().default(20),
//         offset: z.number().min(0).optional().default(0),
//       }),
//     )
//     .query(async ({ ctx, input }) => {
//       const { campaignId, limit, offset } = input;
//       const orgId = ctx.auth.orgId;

//       if (!orgId) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "No active organization",
//         });
//       }

//       const allRuns = await ctx.db
//         .select()
//         .from(runs)
//         .where(and(eq(runs.campaignId, campaignId), eq(runs.orgId, orgId)))
//         .limit(limit)
//         .offset(offset)
//         .orderBy(desc(runs.createdAt));

//       const totalCount = await ctx.db
//         .select({ count: count() })
//         .from(runs)
//         .where(and(eq(runs.campaignId, campaignId), eq(runs.orgId, orgId)))
//         .then((result) => result[0]?.count || 0);

//       return {
//         runs: allRuns,
//         totalCount,
//         hasMore: offset + limit < totalCount,
//       };
//     }),

//   // Get a run by ID
//   getById: orgProcedure
//     .input(z.object({ id: z.string().uuid() }))
//     .query(async ({ ctx, input }) => {
//       const orgId = ctx.auth.orgId;

//       if (!orgId) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "No active organization",
//         });
//       }

//       const [run] = await ctx.db
//         .select()
//         .from(runs)
//         .where(and(eq(runs.id, input.id), eq(runs.orgId, orgId)));

//       if (!run) {
//         throw new TRPCError({
//           code: "NOT_FOUND",
//           message: "Run not found",
//         });
//       }

//       // Get the associated campaign
//       const { campaign, template } = await getCampaignTemplate(
//         ctx.db,
//         run.campaignId,
//       );

//       return {
//         ...run,
//         campaign: {
//           ...campaign,
//           config: {
//             basePrompt: template.basePrompt,
//             voicemailMessage: template.voicemailMessage,
//             variables: template.variablesConfig,
//             analysis: template.analysisConfig,
//           },
//         },
//       };
//     }),

//   // Get rows for a run with pagination
//   getRows: orgProcedure
//     .input(
//       z.object({
//         runId: z.string().uuid(),
//         page: z.number().min(1).optional().default(1),
//         pageSize: z.number().min(1).max(100).optional().default(50),
//         filter: z
//           .enum(["all", "pending", "completed", "failed", "calling"])
//           .optional(),
//       }),
//     )
//     .query(async ({ ctx, input }) => {
//       const { runId, page, pageSize, filter } = input;
//       const offset = (page - 1) * pageSize;
//       const orgId = ctx.auth.orgId;

//       if (!orgId) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "No active organization",
//         });
//       }

//       // Build base query
//       let baseCondition = and(eq(rows.runId, runId), eq(rows.orgId, orgId));

//       // Add status filter if specified
//       if (filter && filter !== "all") {
//         baseCondition = and(baseCondition, eq(rows.status, filter));
//       }

//       // Execute query with pagination
//       const rowsData = await ctx.db
//         .select()
//         .from(rows)
//         .where(baseCondition)
//         .limit(pageSize)
//         .offset(offset)
//         .orderBy(rows.sortIndex);

//       // Get total count with same filters
//       const [{ value: totalCount }] = await ctx.db
//         .select({ value: count() })
//         .from(rows)
//         .where(baseCondition)
//         .then((rows) => rows as [{ value: number }]);

//       // Get status counts for filters
//       const statusCounts = await ctx.db
//         .select({
//           status: rows.status,
//           count: count(),
//         })
//         .from(rows)
//         .where(and(eq(rows.runId, runId), eq(rows.orgId, orgId)))
//         .groupBy(rows.status);

//       const counts = {
//         all: totalCount,
//         pending: 0,
//         calling: 0,
//         completed: 0,
//         failed: 0,
//         skipped: 0,
//       };

//       statusCounts.forEach((item) => {
//         counts[item.status as keyof typeof counts] = Number(item.count);
//       });

//       return {
//         rows: rowsData,
//         pagination: {
//           page,
//           pageSize,
//           totalCount,
//           totalPages: Math.ceil(totalCount / pageSize),
//         },
//         counts,
//       };
//     }),

//   // Create a new run
//   // Modify the run creation mutation in src/server/api/routers/run.ts

//   // Create a new run
//   create: orgProcedure
//     .input(
//       z.object({
//         name: z.string().min(1),
//         campaignId: z.string().uuid(),
//         customPrompt: z.string().optional(),
//         customVoicemailMessage: z.string().optional(),
//         aiGenerated: z.boolean().optional(),
//         variationNotes: z.string().optional(),
//         naturalLanguageInput: z.string().optional(),
//         promptVersion: z.number().optional(),
//         scheduledAt: z.string().datetime().optional(),
//         // Add deduplication parameters
//         clientRequestId: z.string().optional(),
//       }),
//     )
//     .mutation(async ({ ctx, input }) => {
//       const orgId = ctx.auth.orgId;

//       if (!orgId) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "No active organization",
//         });
//       }

//       // Check for duplicate run with the same name in this campaign
//       // This will prevent duplicate runs from being created
//       if (input.clientRequestId) {
//         console.log(
//           `Checking for existing run with clientRequestId: ${input.clientRequestId}`,
//         );

//         // Look for a recently created run with the same client request ID
//         const existingRuns = await ctx.db
//           .select()
//           .from(runs)
//           .where(
//             and(
//               eq(runs.campaignId, input.campaignId),
//               eq(runs.orgId, orgId),
//               sql`${runs.metadata}->>'clientRequestId' = ${input.clientRequestId}`,
//               sql`${runs.createdAt} > NOW() - INTERVAL '30 minutes'`,
//             ),
//           )
//           .limit(1);

//         if (existingRuns.length > 0) {
//           console.log(
//             `Found existing run with ID ${existingRuns[0].id} for clientRequestId ${input.clientRequestId}`,
//           );

//           // Revalidate Paths
//           revalidatePath("/campaigns/[campaignId]", "page");
//           revalidatePath("/campaigns/[campaignId]/runs", "page");
//           revalidatePath("/campaigns/[campaignId]/runs/[runId]", "page");
//           return existingRuns[0];
//         }
//       } else {
//         // If no client request ID, check by name as a fallback
//         const existingRuns = await ctx.db
//           .select()
//           .from(runs)
//           .where(
//             and(
//               eq(runs.campaignId, input.campaignId),
//               eq(runs.orgId, orgId),
//               eq(runs.name, input.name),
//               sql`${runs.createdAt} > NOW() - INTERVAL '5 minutes'`,
//             ),
//           )
//           .limit(1);

//         if (existingRuns.length > 0) {
//           console.log(
//             `Found existing run with same name ${input.name} created in the last 5 minutes, skipping creation`,
//           );
//           return existingRuns[0];
//         }
//       }

//       // Verify the campaign exists and belongs to the organization
//       const [campaign] = await ctx.db
//         .select()
//         .from(campaigns)
//         .where(
//           and(eq(campaigns.id, input.campaignId), eq(campaigns.orgId, orgId)),
//         );

//       if (!campaign) {
//         throw new TRPCError({
//           code: "NOT_FOUND",
//           message: "Campaign not found",
//         });
//       }

//       // Create empty metadata structure
//       const metadata = {
//         rows: {
//           total: 0,
//           invalid: 0,
//         },
//         calls: {
//           total: 0,
//           completed: 0,
//           failed: 0,
//           calling: 0,
//           pending: 0,
//           skipped: 0,
//           voicemail: 0,
//           connected: 0,
//           converted: 0,
//           inbound_returns: 0, // Track inbound returns
//         },
//         run: {
//           createdAt: new Date().toISOString(),
//         },
//         // Store the client request ID to help with deduplication
//         clientRequestId: input.clientRequestId,
//       };

//       const customPrompt = input.customPrompt || undefined;
//       const customVoicemailMessage = input.customVoicemailMessage || undefined;
//       const aiGenerated = input.aiGenerated || undefined;
//       const variationNotes = input.variationNotes || undefined;
//       const naturalLanguageInput = input.naturalLanguageInput || undefined;
//       const promptVersion = input.promptVersion || undefined;

//       // Create the run
//       const [run] = await ctx.db
//         .insert(runs)
//         .values({
//           campaignId: input.campaignId,
//           orgId,
//           name: input.name,
//           status: "draft",
//           customPrompt,
//           customVoicemailMessage,
//           aiGenerated,
//           variationNotes,
//           naturalLanguageInput,
//           promptVersion,
//           metadata,
//           scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
//         } as typeof runs.$inferInsert)
//         .returning();

//       return run;
//     }),

//   // Validate file data without uploading
//   validateData: orgProcedure
//     .input(
//       z.object({
//         campaignId: z.string().uuid(),
//         fileContent: z.string(),
//         fileName: z.string(),
//       }),
//     )
//     .mutation(async ({ ctx, input }) => {
//       const { campaignId, fileContent, fileName } = input;
//       const orgId = ctx.auth.orgId;

//       if (!orgId) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "No active organization",
//         });
//       }

//       // Get the campaign and template
//       const { template, campaignWithConfig } = await getCampaignTemplate(
//         ctx.db,
//         campaignId,
//       );

//       try {
//         // Parse the file content based on the campaign configuration
//         console.log(`Parsing file: ${fileName}`);
//         const parsedData = await parseFileContent(fileContent, fileName);
//         console.log(
//           `Parsed ${parsedData.rows.length} rows with headers: ${parsedData.headers.join(", ")}`,
//         );

//         // Use the config from campaignWithConfig for consistent structure
//         const variablesConfig = campaignWithConfig.config.variables || {
//           patient: { fields: [] },
//           campaign: { fields: [] },
//         };

//         // Extract patient and campaign fields based on the configuration
//         const patientFields = variablesConfig.patient.fields.map((f) => f.key);
//         const campaignFields = variablesConfig.campaign.fields.map(
//           (f) => f.key,
//         );

//         return {
//           parsedData,
//           patientFields,
//           campaignFields,
//           totalRows: parsedData.rows.length, // Explicitly return the row count
//           rowSample: parsedData.rows.slice(0, 1), // Return a sample row for debugging
//         };
//       } catch (error) {
//         console.error("Error validating file:", error);
//         throw new TRPCError({
//           code: "INTERNAL_SERVER_ERROR",
//           message: `Failed to validate file: ${(error as Error).message}`,
//         });
//       }
//     }),

//   // Update uploadFile to accept processed data
//   uploadFile: orgProcedure
//     .input(
//       z.object({
//         runId: z.string().uuid(),
//         fileContent: z.string(),
//         fileName: z.string(),
//         processedData: z
//           .array(
//             z.object({
//               id: z.string(),
//               isValid: z.boolean(),
//               patientData: z.record(z.any()),
//               campaignData: z.record(z.any()),
//             }),
//           )
//           .optional(),
//       }),
//     )
//     .mutation(async ({ ctx, input }) => {
//       const { runId, fileContent, fileName, processedData } = input;
//       const orgId = ctx.auth.orgId;

//       if (!orgId) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "No active organization",
//         });
//       }

//       // Get the run and associated campaign
//       const [run] = await ctx.db
//         .select()
//         .from(runs)
//         .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

//       if (!run) {
//         throw new TRPCError({
//           code: "NOT_FOUND",
//           message: "Run not found",
//         });
//       }

//       // Get the campaign
//       const [campaign] = await ctx.db
//         .select()
//         .from(campaigns)
//         .where(eq(campaigns.id, run.campaignId));

//       if (!campaign) {
//         throw new TRPCError({
//           code: "NOT_FOUND",
//           message: "Campaign not found",
//         });
//       }

//       // Update run status to processing
//       await ctx.db
//         .update(runs)
//         .set({ status: "processing" } as Partial<typeof runs.$inferInsert>)
//         .where(eq(runs.id, runId));

//       try {
//         // Process the Excel file if processed data is not provided
//         let processedDataResult;

//         if (processedData && processedData.length > 0) {
//           // Use the pre-processed data from the review step
//           const validRows = processedData
//             .filter((row) => row.isValid)
//             .map((row) => {
//               // Combine patient and campaign data
//               return {
//                 patientId: null, // Will be set during insertion
//                 patientHash: null, // Will be set during insertion
//                 variables: {
//                   ...row.patientData,
//                   ...row.campaignData,
//                 },
//               };
//             });

//           // Count invalid rows
//           const invalidRowsCount = processedData.filter(
//             (row) => !row.isValid,
//           ).length;

//           processedDataResult = {
//             validRows,
//             invalidRows: [],
//             stats: {
//               totalRows: processedData.length,
//               validRows: validRows.length,
//               invalidRows: invalidRowsCount,
//               uniquePatients: validRows.length, // Simplified, will be updated during patient creation
//               duplicatePatients: 0,
//             },
//             columnMappings: {}, // Not needed since we already processed
//             errors: [],
//             rawFileUrl: "", // Will be updated by the file processor
//             processedFileUrl: "", // Will be updated by the file processor
//           };

//           // Still process the file to generate the URLs and update patient IDs
//           const campaignData = await getCampaignTemplate(ctx.db, campaign.id);
//           const fullProcessedData = await processExcelFile(
//             fileContent,
//             fileName,
//             campaignData.campaignWithConfig.config,
//             orgId,
//           );

//           // Update URLs from full processing
//           processedDataResult.rawFileUrl = fullProcessedData.rawFileUrl;
//           processedDataResult.processedFileUrl =
//             fullProcessedData.processedFileUrl;

//           // Match patient IDs from full processing if possible
//           for (
//             let i = 0;
//             i < processedDataResult.validRows.length &&
//             i < fullProcessedData.validRows.length;
//             i++
//           ) {
//             const fullRow = fullProcessedData.validRows[i];
//             if (fullRow && processedDataResult.validRows[i]) {
//               processedDataResult.validRows[i]!.patientId = fullRow.patientId;
//               processedDataResult.validRows[i]!.patientHash =
//                 fullRow.patientHash;
//             }
//           }
//         } else {
//           // Process the file normally
//           const campaignData = await getCampaignTemplate(ctx.db, campaign.id);
//           processedDataResult = await processExcelFile(
//             fileContent,
//             fileName,
//             campaignData.campaignWithConfig.config,
//             orgId,
//           );
//         }

//         // Store the processed data as rows
//         console.log("Processing complete. Results:", {
//           validRowsCount: processedDataResult.validRows.length,
//           invalidRowsCount: processedDataResult.invalidRows.length,
//           totalRows: processedDataResult.stats.totalRows,
//           errors: processedDataResult.errors,
//         });

//         if (processedDataResult.invalidRows.length > 0) {
//           console.log(
//             "Invalid rows:",
//             JSON.stringify(processedDataResult.invalidRows, null, 2),
//           );
//         }

//         const rowsToInsert = processedDataResult.validRows.map(
//           (rowData, index) => ({
//             runId,
//             orgId,
//             variables: rowData.variables,
//             patientId: rowData.patientId,
//             status: "pending",
//             sortIndex: index,
//           }),
//         );

//         console.log(`Rows to insert: ${rowsToInsert.length}`);

//         if (rowsToInsert.length > 0) {
//           console.log(
//             "First row to insert:",
//             JSON.stringify(rowsToInsert[0], null, 2),
//           );
//           await ctx.db.insert(rows).values(rowsToInsert);
//           console.log("Rows inserted successfully");
//         } else {
//           console.log("No valid rows to insert");
//         }

//         // Update run metadata with results
//         const updatedMetadata = {
//           ...run.metadata,
//           rows: {
//             total: processedDataResult.validRows.length,
//             invalid: processedDataResult.invalidRows.length,
//           },
//           calls: {
//             ...run.metadata?.calls,
//             total: processedDataResult.validRows.length,
//             pending: processedDataResult.validRows.length,
//           },
//         };

//         // Update run status and metadata
//         await ctx.db
//           .update(runs)
//           .set({
//             status: "ready",
//             metadata: updatedMetadata,
//             rawFileUrl: processedDataResult.rawFileUrl,
//             processedFileUrl: processedDataResult.processedFileUrl,
//           } as Partial<typeof runs.$inferInsert>)
//           .where(eq(runs.id, runId));

//         // Send real-time update
//         await pusherServer.trigger(`org-${orgId}`, "run-updated", {
//           runId,
//           status: "ready",
//           metadata: updatedMetadata,
//         });

//         return {
//           success: true,
//           rowsAdded: processedDataResult.validRows.length,
//           invalidRows: processedDataResult.invalidRows.length,
//           errors: processedDataResult.errors,
//         };
//       } catch (error) {
//         // Update run status to failed
//         const errorMessage =
//           error instanceof Error ? error.message : "Unknown error";

//         const updatedMetadata = {
//           ...run.metadata,
//           run: {
//             ...run.metadata?.run,
//             error: errorMessage,
//           },
//         };

//         await ctx.db
//           .update(runs)
//           .set({
//             status: "failed",
//             metadata: updatedMetadata,
//           } as Partial<typeof runs.$inferInsert>)
//           .where(eq(runs.id, runId));

//         // Send real-time update
//         await pusherServer.trigger(`org-${orgId}`, "run-updated", {
//           runId,
//           status: "failed",
//           metadata: updatedMetadata,
//         });

//         throw new TRPCError({
//           code: "INTERNAL_SERVER_ERROR",
//           message: `Failed to process file: ${errorMessage}`,
//           cause: error,
//         });
//       }
//     }),

//   // Update a run's prompt
//   updatePrompt: orgProcedure
//     .input(
//       z.object({
//         runId: z.string().uuid(),
//         customPrompt: z.string(),
//       }),
//     )
//     .mutation(async ({ ctx, input }) => {
//       const { runId, customPrompt } = input;
//       const orgId = ctx.auth.orgId;

//       if (!orgId) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "No active organization",
//         });
//       }

//       const [run] = await ctx.db
//         .update(runs)
//         .set({ customPrompt } as Partial<typeof runs.$inferInsert>)
//         .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)))
//         .returning();

//       if (!run) {
//         throw new TRPCError({
//           code: "NOT_FOUND",
//           message: "Run not found",
//         });
//       }

//       return run;
//     }),

//   // Schedule a run
//   schedule: orgProcedure
//     .input(
//       z.object({
//         runId: z.string().uuid(),
//         scheduledAt: z.string().datetime(),
//       }),
//     )
//     .mutation(async ({ ctx, input }) => {
//       const { runId, scheduledAt } = input;
//       const orgId = ctx.auth.orgId;

//       if (!orgId) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "No active organization",
//         });
//       }

//       const [run] = await ctx.db
//         .update(runs)
//         .set({
//           scheduledAt: new Date(scheduledAt),
//           status: "scheduled",
//         } as Partial<typeof runs.$inferInsert>)
//         .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)))
//         .returning();

//       if (!run) {
//         throw new TRPCError({
//           code: "NOT_FOUND",
//           message: "Run not found",
//         });
//       }

//       // Update metadata
//       const updatedMetadata = {
//         ...run.metadata,
//         run: {
//           ...run.metadata?.run,
//           scheduledTime: scheduledAt,
//         },
//       };

//       await ctx.db
//         .update(runs)
//         .set({ metadata: updatedMetadata } as Partial<typeof runs.$inferInsert>)
//         .where(eq(runs.id, runId));

//       // Send real-time update
//       await pusherServer.trigger(`org-${orgId}`, "run-updated", {
//         runId,
//         status: "scheduled",
//         metadata: updatedMetadata,
//       });

//       return run;
//     }),

//   // Start a run
//   start: orgProcedure
//     .input(z.object({ runId: z.string().uuid() }))
//     .mutation(async ({ ctx, input }) => {
//       const { runId } = input;
//       const orgId = ctx.auth.orgId;

//       if (!orgId) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "No active organization",
//         });
//       }

//       // Get the run
//       const [run] = await ctx.db
//         .select()
//         .from(runs)
//         .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

//       if (!run) {
//         throw new TRPCError({
//           code: "NOT_FOUND",
//           message: "Run not found",
//         });
//       }

//       // Check if run can be started
//       if (
//         run.status !== "ready" &&
//         run.status !== "paused" &&
//         run.status !== "scheduled"
//       ) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: `Run cannot be started from ${run.status} status`,
//         });
//       }

//       // Update run status to running
//       const startTime = new Date().toISOString();
//       const updatedMetadata = {
//         ...run.metadata,
//         run: {
//           ...run.metadata?.run,
//           startTime: run.metadata?.run?.startTime || startTime,
//         },
//       };

//       await ctx.db
//         .update(runs)
//         .set({
//           status: "running",
//           metadata: updatedMetadata,
//         } as Partial<typeof runs.$inferInsert>)
//         .where(eq(runs.id, runId));

//       // Send real-time update
//       await pusherServer.trigger(`org-${orgId}`, "run-updated", {
//         runId,
//         status: "running",
//         metadata: updatedMetadata,
//       });

//       // Start call processing
//       const callProcessor = new CallProcessor(ctx.db);
//       void callProcessor.processRun(runId, orgId);

//       return { success: true, status: "running" };
//     }),

//   // Pause a run
//   pause: orgProcedure
//     .input(z.object({ runId: z.string().uuid() }))
//     .mutation(async ({ ctx, input }) => {
//       const { runId } = input;
//       const orgId = ctx.auth.orgId;

//       if (!orgId) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "No active organization",
//         });
//       }

//       // Get the run
//       const [run] = await ctx.db
//         .select()
//         .from(runs)
//         .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

//       if (!run) {
//         throw new TRPCError({
//           code: "NOT_FOUND",
//           message: "Run not found",
//         });
//       }

//       // Check if run can be paused
//       if (run.status !== "running") {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "Only running runs can be paused",
//         });
//       }

//       // Update run status to paused
//       const pausedAt = new Date().toISOString();
//       const updatedMetadata = {
//         ...run.metadata,
//         run: {
//           ...run.metadata?.run,
//           lastPausedAt: pausedAt,
//         },
//       };

//       await ctx.db
//         .update(runs)
//         .set({
//           status: "paused",
//           metadata: updatedMetadata,
//         } as Partial<typeof runs.$inferInsert>)
//         .where(eq(runs.id, runId));

//       // Send real-time update
//       await pusherServer.trigger(`org-${orgId}`, "run-updated", {
//         runId,
//         status: "paused",
//         metadata: updatedMetadata,
//       });

//       return { success: true, status: "paused" };
//     }),

//   // Get run statistics
//   getStats: orgProcedure
//     .input(z.object({ runId: z.string().uuid() }))
//     .query(async ({ ctx, input }) => {
//       const { runId } = input;
//       const orgId = ctx.auth.orgId;

//       if (!orgId) {
//         throw new TRPCError({
//           code: "BAD_REQUEST",
//           message: "No active organization",
//         });
//       }

//       // Get the run
//       const [run] = await ctx.db
//         .select()
//         .from(runs)
//         .where(and(eq(runs.id, runId), eq(runs.orgId, orgId)));

//       if (!run) {
//         throw new TRPCError({
//           code: "NOT_FOUND",
//           message: "Run not found",
//         });
//       }

//       // Get row statistics
//       const rowStats = await ctx.db
//         .select({
//           status: rows.status,
//           count: count(),
//         })
//         .from(rows)
//         .where(eq(rows.runId, runId))
//         .groupBy(rows.status);

//       // Get call statistics
//       const callStats = await ctx.db
//         .select({
//           status: calls.status,
//           count: count(),
//         })
//         .from(calls)
//         .where(eq(calls.runId, runId))
//         .groupBy(calls.status);

//       return {
//         metadata: run.metadata,
//         rowStats,
//         callStats,
//       };
//     }),
// });
