import { z } from "zod";

// Define the schema for the streamed metadata
export const streamedMetadataSchema = z.object({
  suggestedRunName: z.string().optional(),
  summary: z.string().optional(),
  currentTask: z.string().optional(),
  processingStatus: z
    .object({
      craftingPrompt: z.boolean().optional(),
      ensuringVoicemailMessage: z.boolean().optional(),
      analyzingChanges: z.boolean().optional(),
      generatingMetadata: z.boolean().optional(),
      complete: z.boolean().optional(),
    })
    .optional(),
  metadata: z
    .object({
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      keyChanges: z.array(z.string()).optional(),
      toneShift: z.string().optional(),
      focusArea: z.string().optional(),
      promptLength: z
        .object({
          before: z.number().optional(),
          after: z.number().optional(),
          difference: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  newPrompt: z.string().optional(),
  newVoicemailMessage: z.string().optional(),
});

export type StreamedMetadata = z.infer<typeof streamedMetadataSchema>;
