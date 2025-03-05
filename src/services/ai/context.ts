"server-only";

// src/lib/ai/prompt-generator.ts - Fixed version
import anthropic from "@/lib/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Output schema for the enhanced campaign content
 */
export type TGenerateContextInstructions = {
  instructions: string;
};

/**
 * Takes in data from the inbound webhook handler (may have context about the patient, campaign, etc.)
 * Generates a prompt message for the AI to generate context instructions
 *
 * @param campaignId The ID of the campaign to generate context instructions for
 * @returns A promise that resolves to the generated context instructions
 */

export async function generateContextInstructions(
  context: Record<string, any>,
): Promise<TGenerateContextInstructions> {
  // Log the inputs for debugging
  console.log("Generating context instructions with inputs:");
  console.log(context);
  // Validate input parameters
  if (!context) {
    throw new Error("Context is required");
  }

  // Create a more detailed system prompt with clear instructions
  const systemPrompt = `
  You are a helpful assistant that generates context instructions for a call.
  The instructions should be concise and to the point, and should be no more than 100 words.
  `;

  // Create a well-formatted user prompt
  const userPrompt = `
  Here is the context for the call:
  ${JSON.stringify(context)}

  Generate context instructions for the call.
  `;

  try {
    console.log(
      "Calling AI generator to create inbound context instructions...",
    );

    // Use AI model to generate the enhanced content
    const { object } = await generateObject({
      model: anthropic("claude-3-haiku-20240307"),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: 4000,
      schema: z.object({
        instructions: z.string().min(10),
      }),
    });

    console.log(
      "AI generation completed successfully for inbound context instructions",
    );

    // Verify the result has the expected structure and content
    const result = object as TGenerateContextInstructions;

    return result;
  } catch (error) {
    console.error("Error generating context instructions:", error);

    // TODO: Return a fallback response if AI generation fails

    throw new Error(
      "Failed to generate context instructions: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}
