"use server";

import { requireOrg } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import { runService } from "@/services/runs";
import { z } from "zod";

// Client-side schema without orgId
const clientRunsSchema = z.object({
  campaignId: z.string().uuid(),
  limit: z.number().optional().default(20),
  offset: z.number().optional().default(0),
});

export async function getRuns(params: unknown) {
  const { orgId } = await requireOrg();

  // Validate client params without requiring orgId
  const validated = clientRunsSchema.parse(params);

  const result = await runService.getAll({
    ...validated,
    orgId, // Add orgId from requireOrg
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

// Client-side schema for run rows
const clientRunRowsSchema = z.object({
  runId: z.string().uuid(),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
  filter: z.string().optional(),
});

export async function getRunRows(params: unknown) {
  const { orgId } = await requireOrg();

  // Validate client params without requiring orgId
  const validated = clientRunRowsSchema.parse(params);

  const result = await runService.getRunRows({
    ...validated,
    orgId, // Add orgId from requireOrg
    runId: validated.runId,
    limit: validated.limit,
    offset: validated.offset,
    filter: validated.filter,
  });

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return result.data;
}
