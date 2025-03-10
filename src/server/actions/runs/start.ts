// src/actions/runs/start.ts
"use server";

import { requireOrg } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import { startRunSchema } from "@/lib/validation/runs";
import { runService } from "@/services/runs";
import { revalidatePath } from "next/cache";

export async function startRun(data: unknown) {
  try {
    console.log("Starting run with data:", data);
    const { orgId } = await requireOrg();
    console.log("Organization ID:", orgId);

    const { runId } = startRunSchema.parse(data);
    console.log("Run ID after validation:", runId);

    const result = await runService.start(runId, orgId);
    console.log("Run start result:", result);

    if (isError(result)) {
      console.error("Error starting run:", result.error);
      throw new Error(result.error.message);
    }

    // Revalidate run page
    revalidatePath(`/campaigns/[campaignId]/runs/${runId}`);

    return result.data;
  } catch (error) {
    console.error("Exception in startRun server action:", error);
    throw error;
  }
}

export async function pauseRun(data: unknown) {
  try {
    console.log("Pausing run with data:", data);
    const { orgId } = await requireOrg();
    console.log("Organization ID:", orgId);

    const { runId } = startRunSchema.parse(data);
    console.log("Run ID after validation:", runId);

    const result = await runService.pause(runId, orgId);
    console.log("Run pause result:", result);

    if (isError(result)) {
      console.error("Error pausing run:", result.error);
      throw new Error(result.error.message);
    }

    // Revalidate run page
    revalidatePath(`/campaigns/[campaignId]/runs/${runId}`);

    return result.data;
  } catch (error) {
    console.error("Exception in pauseRun server action:", error);
    throw error;
  }
}
