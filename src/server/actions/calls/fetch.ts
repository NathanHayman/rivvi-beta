// src/actions/calls/fetch.ts
"use server";

import { requireOrg } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import { getCallsSchema } from "@/lib/validation/calls";
import { callService } from "@/services/calls/calls-service";

export async function getCalls(params = {}) {
  const { orgId } = await requireOrg();
  const validated = getCallsSchema.parse(params);

  const result = await callService.getAll({
    ...validated,
    orgId,
  });

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return result.data;
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

export async function getCallTranscript(callId: string) {
  const { orgId } = await requireOrg();

  const result = await callService.getTranscript(callId, orgId);

  if (isError(result)) {
    if (result.error.code === "NOT_FOUND") {
      return { transcript: null, message: "Transcript not available" };
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
