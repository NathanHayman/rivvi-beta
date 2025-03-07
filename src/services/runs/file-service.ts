// src/services/runs/file-service.ts
import {
  ServiceResult,
  createError,
  createSuccess,
} from "@/lib/service-result";
import { db } from "@/server/db";
import { rows, runs } from "@/server/db/schema";
import { processExcelFile } from "@/services/out/file/processor";
import { type ProcessedFileData } from "@/types/api/runs";
import { and, eq } from "drizzle-orm";

export const fileService = {
  async processFile(
    fileContent: string,
    fileName: string,
    runId: string,
    orgId: string,
  ): Promise<ServiceResult<ProcessedFileData>> {
    // Declare run variable at the function scope level
    let run: any = null;

    try {
      // Get the run
      run = await db.query.runs.findFirst({
        where: and(eq(runs.id, runId), eq(runs.orgId, orgId)),
        with: {
          campaign: {
            with: {
              template: true,
            },
          },
        },
      });

      if (!run) {
        return createError("NOT_FOUND", "Run not found");
      }

      // Update run status to processing
      await db
        .update(runs)
        .set({ status: "processing" } as Partial<typeof runs.$inferInsert>)
        .where(eq(runs.id, runId));

      // Process file based on campaign configuration
      // Use a type assertion to correctly access the nested properties
      type RunWithRelations = {
        campaign: {
          template: {
            variablesConfig: any;
          };
        };
      };

      const campaignConfig = (run as unknown as RunWithRelations).campaign
        .template.variablesConfig;
      const processedData = await processExcelFile(
        fileContent,
        fileName,
        campaignConfig,
        orgId,
      );

      // Insert rows
      if (processedData.validRows.length > 0) {
        const rowsToInsert = processedData.validRows.map((rowData, index) => ({
          runId,
          orgId,
          variables: rowData.variables,
          patientId: rowData.patientId,
          status: "pending",
          sortIndex: index,
        }));

        await db.insert(rows).values(rowsToInsert);
      }

      // Update run metadata
      const updatedMetadata = {
        rows: {
          total: processedData.validRows.length,
          invalid: processedData.invalidRows.length,
        },
        calls: {
          total: processedData.validRows.length,
          pending: processedData.validRows.length,
          completed: 0,
          failed: 0,
          calling: 0,
          skipped: 0,
          voicemail: 0,
          connected: 0,
          converted: 0,
        },
      };

      // Update run status to ready
      await db
        .update(runs)
        .set({
          status: "ready",
          metadata: updatedMetadata,
          rawFileUrl: processedData.rawFileUrl,
          processedFileUrl: processedData.processedFileUrl,
        } as Partial<typeof runs.$inferInsert>)
        .where(eq(runs.id, runId));

      return createSuccess({
        rowsAdded: processedData.validRows.length,
        invalidRows: processedData.invalidRows.length,
        errors: processedData.errors,
        success: true,
      });
    } catch (error) {
      console.error("Error processing file:", error);

      // Update run status to failed
      if (run) {
        await db
          .update(runs)
          .set({
            status: "failed",
            metadata: {
              ...run.metadata,
              error: error.message || "Unknown error",
            },
          } as Partial<typeof runs.$inferInsert>)
          .where(eq(runs.id, runId));
      }

      return createError("INTERNAL_ERROR", "Failed to process file", error);
    }
  },
};
