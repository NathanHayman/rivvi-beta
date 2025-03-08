"use server";

import { requireOrg } from "@/lib/auth/auth-utils";
import { isError } from "@/lib/service-result";
import { runService } from "@/services/runs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Define the schema for creating a run
const createRunSchema = z.object({
  campaignId: z.string().uuid(),
  name: z.string().min(1, "Run name is required"),
  customPrompt: z.string().optional(),
  customVoicemailMessage: z.string().optional(),
  variationNotes: z.string().optional(),
  naturalLanguageInput: z.string().optional(),
  promptVersion: z.number().optional(),
  aiGenerated: z.boolean().optional(),
  scheduledAt: z.string().optional(),
});

export type TCreateRun = z.infer<typeof createRunSchema>;

export async function createRun(data: TCreateRun) {
  const { orgId } = await requireOrg();
  const validated = createRunSchema.parse(data);

  // Extract metadata from AI-related fields
  const metadata: Record<string, any> = {};
  if (
    validated.variationNotes ||
    validated.promptVersion ||
    validated.aiGenerated ||
    validated.naturalLanguageInput
  ) {
    metadata.ai = {
      variationNotes: validated.variationNotes,
      promptVersion: validated.promptVersion,
      aiGenerated: validated.aiGenerated,
      naturalLanguageInput: validated.naturalLanguageInput,
    };
  }

  const result = await runService.createRun({
    name: validated.name,
    campaignId: validated.campaignId,
    orgId,
    customPrompt: validated.customPrompt,
    customVoicemailMessage: validated.customVoicemailMessage,
    scheduledAt: validated.scheduledAt,
    metadata,
  });

  if (isError(result)) {
    throw new Error(result.error.message);
  }

  // Revalidate relevant paths
  revalidatePath(`/campaigns/${validated.campaignId}/runs`);
  revalidatePath(`/campaigns/${validated.campaignId}`);

  return result.data;
}
