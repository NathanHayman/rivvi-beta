// src/actions/calls/fetch.ts
"use server";

import { requireOrg } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import { getCallsSchema } from "@/lib/validation/calls";
import { callService } from "@/services/calls/calls-service";

export async function getCalls(params = {}) {
  const { orgId } = await requireOrg();

  // Ensure params is an object and not a string or other type
  const safeParams =
    typeof params === "object" && params !== null ? params : {};

  // Clean up UUID parameters to prevent comma-separated lists
  const cleanParams: Record<string, any> = { ...safeParams };

  // Check if patientId contains commas (indicating multiple UUIDs)
  if (
    typeof cleanParams.patientId === "string" &&
    cleanParams.patientId.includes(",")
  ) {
    console.warn(
      "Invalid patientId format (comma-separated list detected). Setting to undefined.",
    );
    cleanParams.patientId = undefined;
  }

  // Check if runId contains commas (indicating multiple UUIDs)
  if (
    typeof cleanParams.runId === "string" &&
    cleanParams.runId.includes(",")
  ) {
    console.warn(
      "Invalid runId format (comma-separated list detected). Setting to undefined.",
    );
    cleanParams.runId = undefined;
  }

  try {
    const validated = getCallsSchema.parse(cleanParams);

    const result = await callService.getAll({
      ...validated,
      orgId,
    });

    if (isError(result)) {
      throw new Error(result.error.message);
    }

    return result.data;
  } catch (error) {
    console.error("Error in getCalls:", error);
    // Return empty result set on validation error
    return { calls: [], totalCount: 0, hasMore: false };
  }
}

export async function getCall(id: string) {
  const { orgId } = await requireOrg();

  const result = await callService.getById(id, orgId);

  if (isError(result)) {
    if (result.error.code === "NOT_FOUND") {
      return null;
    }
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function getPatientCalls(patientId: string, limit = 10) {
  const { orgId } = await requireOrg();

  const result = await callService.getPatientCalls(patientId, orgId, limit);

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return result.data;
}
