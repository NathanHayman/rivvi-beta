// src/actions/runs/file.ts
"use server";

import { requireOrg } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import { uploadFileSchema } from "@/lib/validation/runs";
import { processExcelFile } from "@/services/out/file/processor";
import { fileService } from "@/services/runs/file-service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Upload file action
export async function uploadFile(data: unknown) {
  const { orgId } = await requireOrg();
  const validated = uploadFileSchema.parse(data);

  const result = await fileService.processFile(
    validated.fileContent,
    validated.fileName,
    validated.runId,
    orgId,
  );

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  // Revalidate relevant paths
  revalidatePath(`/campaigns/[campaignId]/runs/${validated.runId}`);

  return result.data;
}

// Validate file data schema
const validateDataSchema = z.object({
  fileContent: z.string(),
  fileName: z.string(),
});

// Validate file data action
export async function validateData(data: unknown) {
  const { orgId } = await requireOrg();
  const validated = validateDataSchema.parse(data);

  try {
    // Process the file without saving to get validation results
    const processedData = await processExcelFile(
      validated.fileContent,
      validated.fileName,
      {}, // Empty config for validation only
      orgId,
    );

    return {
      success: true,
      totalRows:
        processedData.validRows.length + processedData.invalidRows.length,
      validRows: processedData.validRows.length,
      invalidRows: processedData.invalidRows.length,
      errors: processedData.errors || [],
      parsedData: {
        headers: processedData.headers || [],
        rows: processedData.validRows || [],
      },
    };
  } catch (error) {
    console.error("Error validating file data:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to validate file",
    );
  }
}
