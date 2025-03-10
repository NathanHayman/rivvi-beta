"use server";

import { requireOrg } from "@/lib/auth";
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
  scheduledAt: z.string().nullable().optional(),
  summary: z.string().optional(),
  metadata: z
    .object({
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      keyChanges: z.array(z.string()).optional(),
      toneShift: z.string().optional(),
      focusArea: z.string().optional(),
      promptLength: z
        .object({
          before: z.number(),
          after: z.number(),
          difference: z.number(),
        })
        .optional(),
      changeIntent: z.string().optional(),
      sentimentShift: z
        .object({
          before: z.string().optional(),
          after: z.string().optional(),
        })
        .optional(),
      formalityLevel: z
        .object({
          before: z.number().optional(),
          after: z.number().optional(),
        })
        .optional(),
      complexityScore: z
        .object({
          before: z.number().optional(),
          after: z.number().optional(),
        })
        .optional(),
    })
    .optional()
    .nullable(),
  comparison: z
    .object({
      structuralChanges: z
        .array(
          z.object({
            section: z.string().optional(),
            changeType: z
              .enum(["added", "removed", "modified", "unchanged"])
              .optional(),
            description: z.string().optional(),
          }),
        )
        .optional(),
      keyPhrases: z
        .object({
          added: z.array(z.string()).optional(),
          removed: z.array(z.string()).optional(),
          modified: z
            .union([
              z.array(
                z.union([
                  z.string(),
                  z.object({
                    before: z.string().optional(),
                    after: z.string().optional(),
                  }),
                ]),
              ),
              z.array(
                z.object({
                  before: z.string().optional(),
                  after: z.string().optional(),
                }),
              ),
            ])
            .optional()
            .transform((val) => {
              if (!val) return undefined;
              return val.map((item) => {
                // If item is a string, convert it to an object with after property
                if (typeof item === "string") {
                  return { after: item };
                }
                return item;
              });
            }),
        })
        .optional(),
      performancePrediction: z
        .object({
          expectedImpact: z
            .enum(["positive", "neutral", "negative", "uncertain"])
            .optional(),
          confidenceLevel: z.number().optional(),
          rationale: z.string().optional(),
        })
        .optional(),
    })
    .optional()
    .nullable(),
  diffData: z
    .object({
      promptDiff: z
        .array(
          z.object({
            type: z.enum(["unchanged", "added", "removed"]).optional(),
            value: z.string().optional(),
          }),
        )
        .optional(),
      voicemailDiff: z
        .array(
          z.object({
            type: z.enum(["unchanged", "added", "removed"]).optional(),
            value: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional()
    .nullable(),
  scheduleForLater: z.boolean().optional(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  fileContent: z.string().optional(),
});

export type TCreateRun = z.infer<typeof createRunSchema>;

export async function createRun(data: TCreateRun) {
  const { orgId } = await requireOrg();

  // Pre-process data to fix any potential issues
  const processedData = {
    ...data,
    // Ensure scheduledAt is properly handled
    scheduledAt: data.scheduledAt === null ? undefined : data.scheduledAt,
    // Fix comparison.keyPhrases.modified if needed
    comparison: data.comparison && {
      ...data.comparison,
      keyPhrases: data.comparison.keyPhrases && {
        ...data.comparison.keyPhrases,
        modified: data.comparison.keyPhrases.modified
          ? Array.isArray(data.comparison.keyPhrases.modified)
            ? data.comparison.keyPhrases.modified.map((item) => {
                // If item is a string, convert it to an object with after property
                if (typeof item === "string") {
                  return { after: item };
                }
                return item;
              })
            : Object.values(data.comparison.keyPhrases.modified).map((item) => {
                // If item is a string, convert it to an object with after property
                if (typeof item === "string") {
                  return { after: item };
                }
                return item;
              })
          : undefined,
      },
    },
  };

  try {
    // Validate with Zod schema
    const validated = createRunSchema.parse(processedData);

    // Process scheduling
    let scheduledAt = null;
    if (
      validated.scheduleForLater &&
      validated.scheduledDate &&
      validated.scheduledTime
    ) {
      const [hours, minutes] = validated.scheduledTime.split(":").map(Number);
      const date = new Date(validated.scheduledDate);
      date.setHours(hours || 0, minutes || 0, 0, 0);
      scheduledAt = date.toISOString();
    }

    // Create metadata structure
    const metadata: Record<string, any> = {};

    // AI-related metadata
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

    // Add structured metadata from AI streaming if available
    if (validated.metadata) {
      metadata.metadata = validated.metadata;
    }

    // Add comparison data if available
    if (validated.comparison) {
      metadata.comparison = validated.comparison;
    }

    // Add diff data if available
    if (validated.diffData) {
      metadata.diffData = validated.diffData;
    }

    // Add summary directly to the top level of metadata
    if (validated.summary) {
      metadata.summary = validated.summary;
    }

    const result = await runService.createRun({
      name: validated.name,
      campaignId: validated.campaignId,
      orgId,
      customPrompt: validated.customPrompt,
      customVoicemailMessage: validated.customVoicemailMessage,
      scheduledAt,
      metadata,
    });

    if (isError(result)) {
      throw new Error(result.error.message);
    }

    // Revalidate relevant paths
    revalidatePath(`/campaigns/${validated.campaignId}/runs`);
    revalidatePath(`/campaigns/${validated.campaignId}`);

    return result.data;
  } catch (error) {
    console.error("Error in createRun server action:", error);
    console.error("Request data:", {
      ...data,
      // Don't log potentially sensitive content
      customPrompt: data.customPrompt ? "[REDACTED]" : undefined,
      customVoicemailMessage: data.customVoicemailMessage
        ? "[REDACTED]"
        : undefined,
    });
    throw error;
  }
}
