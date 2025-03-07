// src/actions/runs/file.ts
"use server";

import { requireOrg } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import { uploadFileSchema } from "@/lib/validation/runs";
import { fileService } from "@/services/runs/file-service";
import { revalidatePath } from "next/cache";

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
