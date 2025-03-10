// src/actions/patients/fetch.ts
"use server";

import { requireOrg } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import {
  getPatientsSchema,
  searchPatientsSchema,
} from "@/lib/validation/patients";
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

export async function searchPatients(params: unknown) {
  const { orgId } = await requireOrg();
  const validated = searchPatientsSchema.parse(params);

  // Use the existing patientService.getAll method with search parameters
  const result = await patientService.getAll({
    ...validated,
    orgId,
    search: validated.query,
  });

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  return {
    patients: result.data.patients,
    total: result.data.totalCount,
  };
}
