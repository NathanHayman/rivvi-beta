"use server";

import { requireOrg } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import { runService } from "@/services/runs/runs-service";
import { z } from "zod";

// Type definition for the fetchRunRows options
const fetchRunRowsSchema = z.object({
  runId: z.string(),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
  filter: z.string().optional(),
  sortBy: z.string().optional(), // This will be ignored for now
  sortDirection: z.enum(["asc", "desc"]).optional(), // This will be ignored for now
});

/**
 * Fetch rows for a specific run with pagination and optional filtering
 */
export async function fetchRunRows(params: unknown) {
  const { orgId } = await requireOrg();

  // Validate client params
  const validated = fetchRunRowsSchema.parse(params);

  // For now, we'll ignore sortBy and sortDirection since they're not supported by the service
  const result = await runService.getRunRows({
    orgId,
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
