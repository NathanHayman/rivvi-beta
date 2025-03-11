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

/**
 * Server action to fetch calls with improved error handling and parameter validation
 */
export async function getCalls(params: GetCallsParams) {
  try {
    const { orgId } = await requireOrg();

    // Ensure params is an object and not a string or other type
    const safeParams: Record<string, any> =
      typeof params === "object" && params !== null ? { ...params } : {};

    // Clean up UUID parameters to prevent comma-separated lists
    if (
      typeof safeParams.patientId === "string" &&
      safeParams.patientId.includes(",")
    ) {
      console.warn(
        "Invalid patientId format (comma-separated list detected). Setting to undefined.",
      );
      safeParams.patientId = undefined;
    }

    if (
      typeof safeParams.runId === "string" &&
      safeParams.runId.includes(",")
    ) {
      console.warn(
        "Invalid runId format (comma-separated list detected). Setting to undefined.",
      );
      safeParams.runId = undefined;
    }

    // Handle filters - convert "all" values to undefined
    if (safeParams.status === "all") {
      safeParams.status = undefined;
    }

    if (safeParams.direction === "all") {
      safeParams.direction = undefined;
    }

    if (safeParams.campaignId === "all") {
      safeParams.campaignId = undefined;
    }

    // Handle search parameter - normalize empty strings
    if (typeof safeParams.search === "string") {
      safeParams.search = safeParams.search.trim();
      if (safeParams.search === "") {
        safeParams.search = undefined;
      }
    }

    // Robust date handling - convert Date objects to ISO strings
    if (safeParams.startDate) {
      if (safeParams.startDate instanceof Date) {
        safeParams.startDate = safeParams.startDate.toISOString();
      } else if (typeof safeParams.startDate === "string") {
        try {
          // Validate date string format
          new Date(safeParams.startDate).toISOString();
        } catch (e) {
          console.warn(
            "Invalid startDate string format. Setting to undefined.",
          );
          safeParams.startDate = undefined;
        }
      } else {
        console.warn("Invalid startDate type. Setting to undefined.");
        safeParams.startDate = undefined;
      }
    }

    if (safeParams.endDate) {
      if (safeParams.endDate instanceof Date) {
        safeParams.endDate = safeParams.endDate.toISOString();
      } else if (typeof safeParams.endDate === "string") {
        try {
          // Validate date string format
          new Date(safeParams.endDate).toISOString();
        } catch (e) {
          console.warn("Invalid endDate string format. Setting to undefined.");
          safeParams.endDate = undefined;
        }
      } else {
        console.warn("Invalid endDate type. Setting to undefined.");
        safeParams.endDate = undefined;
      }
    }

    // Validate parameters
    const validated = getCallsSchema.parse(safeParams);

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
    // Return empty result set on error
    return { calls: [], totalCount: 0, hasMore: false };
  }
}

/**
 * Server action to fetch a single call by ID
 */
export async function getCall(id: string) {
  try {
    const { orgId } = await requireOrg();

    const result = await callService.getById(id, orgId);

    if (isError(result)) {
      if (result.error.code === "NOT_FOUND") {
        return null;
      }
      throw new Error(result.error.message);
    }

    return result.data;
  } catch (error) {
    console.error("Error in getCall:", error);
    throw new Error("Failed to fetch call");
  }
}

/**
 * Server action to fetch calls for a specific patient
 */
export async function getPatientCalls(patientId: string, limit = 10) {
  try {
    const { orgId } = await requireOrg();

    // Handle case where patientId might be a comma-separated list
    const sanitizedPatientId = patientId.includes(",")
      ? patientId.split(",")[0].trim()
      : patientId;

    const result = await callService.getPatientCalls(
      sanitizedPatientId,
      orgId,
      limit,
    );

    if (isError(result)) {
      throw new Error(result.error.message);
    }

    return result.data;
  } catch (error) {
    console.error("Error in getPatientCalls:", error);
    return [];
  }
}
