// src/actions/runs/start.ts
"use server";

import { requireOrg } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import { startRunSchema } from "@/lib/validation/runs";
import { runService } from "@/services/runs";
import { revalidatePath } from "next/cache";

export async function startRun(data: unknown) {
  const { orgId } = await requireOrg();
  const { runId } = startRunSchema.parse(data);

  const result = await runService.start(runId, orgId);

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  // Revalidate run page
  revalidatePath(`/campaigns/[campaignId]/runs/${runId}`);

  return result.data;
}

export async function pauseRun(data: unknown) {
  const { orgId } = await requireOrg();
  const { runId } = startRunSchema.parse(data);

  const result = await runService.pause(runId, orgId);

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  // Revalidate run page
  revalidatePath(`/campaigns/[campaignId]/runs/${runId}`);

  return result.data;
}
