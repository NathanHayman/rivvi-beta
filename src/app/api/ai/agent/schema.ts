import { z } from "zod";

// Define the schema for the streaming response
export const agentResponseSchema = z.object({
  // Unique identifier for this variation
  variationId: z
    .string()
    .describe("A unique identifier for this prompt variation"),

  // Metadata for UI display and analysis
  metadata: z
    .object({
      categories: z
        .array(z.string())
        .describe("Categories relevant to this prompt variation"),
      tags: z.array(z.string()).describe("Tags for this prompt variation"),
      keyChanges: z
        .array(z.string())
        .describe("Key changes made to the original prompt"),
      toneShift: z
        .string()
        .describe("How the tone has changed from the original"),
      focusArea: z.string().describe("Main focus area of this variation"),
      promptLength: z
        .object({
          before: z.number().describe("Character count of original prompt"),
          after: z.number().describe("Character count of new prompt"),
          difference: z.number().describe("Difference in character count"),
        })
        .describe("Information about prompt length changes"),
      // Added fields for better analysis
      changeIntent: z
        .string()
        .describe("The inferred intent behind the user's requested changes"),
      sentimentShift: z
        .object({
          before: z.string().describe("Sentiment of the original prompt"),
          after: z.string().describe("Sentiment of the modified prompt"),
        })
        .describe("How sentiment has changed from original to modified"),
      formalityLevel: z
        .object({
          before: z
            .number()
            .min(1)
            .max(10)
            .describe("Formality level of original (1-10)"),
          after: z
            .number()
            .min(1)
            .max(10)
            .describe("Formality level of modified (1-10)"),
        })
        .describe("Change in formality level (1=casual, 10=formal)"),
      complexityScore: z
        .object({
          before: z
            .number()
            .min(1)
            .max(10)
            .describe("Complexity of original (1-10)"),
          after: z
            .number()
            .min(1)
            .max(10)
            .describe("Complexity of modified (1-10)"),
        })
        .describe("Change in language complexity (1=simple, 10=complex)"),
    })
    .describe("Metadata about the changes and classifications"),

  // High-level information
  suggestedRunName: z
    .string()
    .describe("A suggested name for this run based on the changes"),
  summary: z.string().describe("Summary of changes made to the prompt"),

  // Detailed comparison data
  comparison: z
    .object({
      structuralChanges: z
        .array(
          z.object({
            section: z
              .string()
              .describe("Section of the prompt (intro, body, cta, etc)"),
            changeType: z.enum(["added", "removed", "modified", "unchanged"]),
            description: z
              .string()
              .describe("Description of what changed in this section"),
          }),
        )
        .describe("Changes broken down by structural sections of the prompt"),
      keyPhrases: z
        .object({
          added: z
            .array(z.string())
            .describe("Important phrases added to the prompt"),
          removed: z
            .array(z.string())
            .describe("Important phrases removed from the prompt"),
          modified: z
            .array(
              z.object({
                before: z.string(),
                after: z.string(),
              }),
            )
            .describe("Important phrases that were modified"),
        })
        .describe("Key phrase differences"),
      performancePrediction: z
        .object({
          expectedImpact: z.enum([
            "positive",
            "neutral",
            "negative",
            "uncertain",
          ]),
          confidenceLevel: z
            .number()
            .min(1)
            .max(10)
            .describe("Confidence in prediction (1-10)"),
          rationale: z.string().describe("Reasoning behind the prediction"),
        })
        .describe("Prediction of how changes might impact performance"),
    })
    .describe("Detailed comparison between original and modified prompts"),

  // The actual generated content (hidden from users but needed for processing)
  newPrompt: z.string().describe("The newly generated prompt"),
  newVoicemailMessage: z
    .string()
    .describe("The newly generated voicemail message"),

  // Diff data for visualization
  diffData: z
    .object({
      promptDiff: z
        .array(
          z.object({
            type: z.enum(["unchanged", "added", "removed"]),
            value: z.string(),
          }),
        )
        .describe("Word-by-word diff of the prompt for visualization"),
      voicemailDiff: z
        .array(
          z.object({
            type: z.enum(["unchanged", "added", "removed"]),
            value: z.string(),
          }),
        )
        .describe(
          "Word-by-word diff of the voicemail message for visualization",
        ),
    })
    .describe("Diff data for visualizing exact changes"),
});

// Type for the response
export type AgentResponse = z.infer<typeof agentResponseSchema>;
