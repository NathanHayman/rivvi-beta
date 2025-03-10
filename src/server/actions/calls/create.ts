// src/actions/calls/create.ts
"use server";

import { requireOrg } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import {
  createManualCallSchema,
  type TCreateManualCall,
} from "@/lib/validation/calls";
import { callService } from "@/services/calls/calls-service";
import { revalidatePath } from "next/cache";

export async function createManualCall(data: TCreateManualCall) {
  const { orgId } = await requireOrg();
  const validated = createManualCallSchema.parse(data);

  const result = await callService.createManualCall({
    ...validated,
    orgId,
    patientId: validated.patientId,
    agentId: validated.agentId,
    campaignId: validated.campaignId,
    variables: validated.variables,
  });

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  // Revalidate relevant paths
  revalidatePath(`/patients/${validated.patientId}`);
  revalidatePath("/calls");

  return result.data;
}
