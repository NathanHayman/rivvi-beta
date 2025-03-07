// src/actions/patients/fetch.ts
"use server";

import { requireOrg } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import { getPatientsSchema } from "@/lib/validation/patients";
import { patientService } from "@/services/patients";

export async function getPatients(params = {}) {
  const { orgId } = await requireOrg();
  const validated = getPatientsSchema.parse(params);

  const result = await patientService.getAll({
    ...validated,
    orgId,
  });

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function getPatient(id: string) {
  const { orgId } = await requireOrg();

  const result = await patientService.getById(id, orgId);

  if (isError(result)) {
    if (result.error.code === "NOT_FOUND") {
      return null;
    }
    throw new Error(result.error.message);
  }

  return result.data;
}
