// src/server/actions/calls/fetch.ts
"use server";

import { requireOrg } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import { getCallsSchema } from "@/lib/validation/calls";
import { callService } from "@/services/calls/calls-service";

export type GetCallsParams = {
  limit?: number;
  offset?: number;
  patientId?: string;
  runId?: string;
  status?: string;
  direction?: string;
  search?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  campaignId?: string;
};

export async function getCalls(params: GetCallsParams) {
  const { orgId } = await requireOrg();

  // Ensure params is an object and not a string or other type
  const safeParams =
    typeof params === "object" && params !== null ? params : {};

  // Clean up and prepare parameters
  const cleanParams: Record<string, any> = { ...safeParams };

  // Clean up UUID parameters to prevent comma-separated lists
  if (
    typeof cleanParams.patientId === "string" &&
    cleanParams.patientId.includes(",")
  ) {
    console.warn(
      "Invalid patientId format (comma-separated list detected). Setting to undefined.",
    );
    cleanParams.patientId = undefined;
  }

  if (
    typeof cleanParams.runId === "string" &&
    cleanParams.runId.includes(",")
  ) {
    console.warn(
      "Invalid runId format (comma-separated list detected). Setting to undefined.",
    );
    cleanParams.runId = undefined;
  }

  // Handle filters
  // Filter by status - convert "all" to undefined
  if (cleanParams.status === "all") {
    cleanParams.status = undefined;
  }

  // Filter by direction - convert "all" to undefined
  if (cleanParams.direction === "all") {
    cleanParams.direction = undefined;
  }

  // Filter by campaignId - convert "all" to undefined
  if (cleanParams.campaignId === "all") {
    cleanParams.campaignId = undefined;
  }

  // Handle search parameter - trim and check if empty
  if (typeof cleanParams.search === "string") {
    cleanParams.search = cleanParams.search.trim();
    if (cleanParams.search === "") {
      cleanParams.search = undefined;
    }
  }

  // Ensure dates are properly converted to ISO strings
  if (cleanParams.startDate) {
    if (cleanParams.startDate instanceof Date) {
      cleanParams.startDate = cleanParams.startDate.toISOString();
    } else if (typeof cleanParams.startDate === "string") {
      // Keep it as is if it's a valid ISO string
      try {
        // Just check if it's a valid date string
        new Date(cleanParams.startDate);
      } catch (e) {
        console.warn("Invalid startDate string format. Setting to undefined.");
        cleanParams.startDate = undefined;
      }
    } else {
      console.warn("Invalid startDate type. Setting to undefined.");
      cleanParams.startDate = undefined;
    }
  }

  if (cleanParams.endDate) {
    if (cleanParams.endDate instanceof Date) {
      cleanParams.endDate = cleanParams.endDate.toISOString();
    } else if (typeof cleanParams.endDate === "string") {
      // Keep it as is if it's a valid ISO string
      try {
        // Just check if it's a valid date string
        new Date(cleanParams.endDate);
      } catch (e) {
        console.warn("Invalid endDate string format. Setting to undefined.");
        cleanParams.endDate = undefined;
      }
    } else {
      console.warn("Invalid endDate type. Setting to undefined.");
      cleanParams.endDate = undefined;
    }
  }

  try {
    // Validate parameters
    const validated = getCallsSchema.parse(cleanParams);

    console.log(
      "Fetching calls with filters:",
      JSON.stringify(
        {
          ...validated,
          orgId,
          startDate: validated.startDate,
          endDate: validated.endDate,
        },
        null,
        2,
      ),
    );

    // Call the service with validated parameters
    const result = await callService.getAll({
      ...validated,
      orgId,
    });

    if (isError(result)) {
      console.error("Error in callService.getAll:", result.error);
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
