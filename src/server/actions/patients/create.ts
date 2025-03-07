// src/actions/patients/create.ts
"use server";

import { requireOrg } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import { createPatientSchema } from "@/lib/validation/patients";
import { patientService } from "@/services/patients";
import { revalidatePath } from "next/cache";

export async function createPatient(data: unknown) {
  const { orgId } = await requireOrg();
  const validated = createPatientSchema.parse(data);

  const result = await patientService.create({
    ...validated,
    orgId,
  });

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  // Revalidate patients list
  revalidatePath("/patients");

  return result.data;
}
