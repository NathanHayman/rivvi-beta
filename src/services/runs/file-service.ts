// src/services/runs/file-service.ts
import { ErrorCode, ServiceResult } from "@/lib/service-result";
import { type ProcessedFileData } from "@/types/api/runs";
import { processExcelFile } from "./excel-processor";

export const FileService = {
  async processFile(
    fileContent: string,
    fileName: string,
    runId: string,
    orgId: string,
    explicitConfig?: any, // Allow passing specific config
    preProcessedData?: {
      headers?: string[];
      rows?: any[];
    },
  ): Promise<ServiceResult<ProcessedFileData>> {
    try {
      // If we already have pre-processed data, use it instead of processing the file again
      if (
        preProcessedData &&
        preProcessedData.rows &&
        preProcessedData.rows.length > 0
      ) {
        console.log(
          `Using pre-processed data with ${preProcessedData.rows.length} rows`,
        );

        // Create a properly formatted result with ALL fields that the UI expects
        return {
          success: true,
          data: {
            totalRows: preProcessedData.rows.length,
            parsedData: {
              rows: preProcessedData.rows,
              headers: preProcessedData.headers || [],
            },
            invalidRows: 0,
            stats: {
              totalRows: preProcessedData.rows.length,
              validRows: preProcessedData.rows.length,
              invalidRows: 0,
              uniquePatients: preProcessedData.rows.length,
              duplicatePatients: 0,
            },
          },
        };
      }

      // Otherwise process the file
      const result = await processExcelFile(
        fileContent,
        fileName,
        explicitConfig,
        orgId,
      );

      if (!result.success) {
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR" as ErrorCode,
            message: result.error?.message || "Failed to process file",
            details: result.error?.details || {},
          },
        };
      }

      // Ensure we capture and include ALL data the UI might check
      return {
        success: true,
        data: {
          totalRows: result.stats?.totalRows || 0,
          parsedData: {
            rows: result.parsedData?.rows || [],
            headers: result.parsedData?.headers || [],
          },
          invalidRows: result.stats?.invalidRows || 0,
          stats: {
            totalRows: result.stats?.totalRows || 0,
            validRows: result.stats?.validRows || 0,
            invalidRows: result.stats?.invalidRows || 0,
            uniquePatients: result.stats?.uniquePatients || 0,
            duplicatePatients: result.stats?.duplicatePatients || 0,
          },
        },
      };
    } catch (error) {
      console.error("Error in file service processFile:", error);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR" as ErrorCode,
          message: (error as Error).message || "Unknown error in file service",
          details: { error: String(error) },
        },
      };
    }
  },
};
