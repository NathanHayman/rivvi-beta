// src/actions/runs/fetch.ts
"use server";

import { requireOrg } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import { getRunsSchema } from "@/lib/validation/runs";
import { runService } from "@/services/runs";

export async function getRuns(params: unknown) {
  const { orgId } = await requireOrg();
  const validated = getRunsSchema.parse(params);

  const result = await runService.getAll({
    ...validated,
    orgId,
  });

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function getRun(id: string) {
  const { orgId } = await requireOrg();

  const result = await runService.getById(id, orgId);

  if (isError(result)) {
    if (result.error.code === "NOT_FOUND") {
      return null;
    }
    throw new Error(result.error.message);
  }

  return result.data;
}
