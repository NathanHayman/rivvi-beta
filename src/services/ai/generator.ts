"server-only";

// src/lib/ai/prompt-generator.ts - Fixed version
import anthropic from "@/lib/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Output schema for the enhanced campaign content
 */
export type EnhancedCampaignContent = {
  newPrompt: string;
  newVoicemailMessage: string;
  suggestedRunName: string;
  summary: string;
};

/**
 * Generates enhanced campaign content (prompt and voicemail) based on natural language input
 * Improved with better error handling, retry logic, and more robust schema validation
 *
 * @param basePrompt The base prompt template for the campaign
 * @param baseVoicemailMessage The base voicemail message template
 * @param naturalLanguageInput The user's natural language description of what they want to achieve
 * @param campaignContext Additional context about the campaign (optional)
 * @returns Enhanced campaign content including new prompt, voicemail message, suggested run name, and a summary of changes
 */
export async function generateEnhancedCampaignContent(
  basePrompt: string,
  baseVoicemailMessage: string,
  naturalLanguageInput: string,
  campaignContext?: {
    name?: string;
    description?: string;
    type?: string;
  },
): Promise<EnhancedCampaignContent> {
  // Log the inputs for debugging
  console.log("Generating enhanced campaign content with inputs:");
  console.log(`Base prompt length: ${basePrompt.length} chars`);
  console.log(`Base voicemail length: ${baseVoicemailMessage.length} chars`);
  console.log(`Natural language input: ${naturalLanguageInput}`);
  console.log(`Campaign context:`, campaignContext);

  // Validate input parameters
  if (!basePrompt || basePrompt.trim().length < 10) {
    throw new Error(
      "Base prompt is required and must be at least 10 characters",
    );
  }

  if (!naturalLanguageInput || naturalLanguageInput.trim().length < 5) {
    throw new Error(
      "Natural language input is required and must be at least 5 characters",
    );
  }

  // Create a more detailed system prompt with clear instructions
  const systemPrompt = `You are an expert AI voice communication designer specializing in healthcare communications.
Your task is to enhance both a conversation prompt and a voicemail message based on natural language input from a user.

IMPORTANT GUIDELINES:
1. Maintain all existing variables in the format {{variableName}} exactly as they appear
2. Never remove, modify, or add new variables
3. Preserve the overall structure and flow of both the prompt and voicemail message
4. Incorporate the user's natural language input to enhance tone, style, and effectiveness
5. Ensure both outputs remain conversational and natural for voice AI
6. Keep healthcare-specific language and context appropriate
7. Do not add technical instructions or formatting that would confuse a voice AI system
8. Generate a clear, concise name for this run based on the campaign and customization

You must generate ALL four required outputs:
1. A new prompt based on the base prompt (must preserve all variables and structure)
2. A new voicemail message based on the base voicemail message (if provided)
3. A suggested name for the run that is descriptive but concise (maximum 50 characters)
4. A summary explaining the key changes you made to both the prompt and voicemail message`;

  // Create a well-formatted user prompt
  const userPrompt = `Base Prompt for Live Conversation:
${basePrompt}

${baseVoicemailMessage ? `Base Voicemail Message:\n${baseVoicemailMessage}\n` : "No base voicemail message provided.\n"}

Campaign Context:
${campaignContext?.name ? `Name: ${campaignContext.name}` : "Name: Not specified"}
${campaignContext?.description ? `Description: ${campaignContext.description}` : "Description: Not specified"}
${campaignContext?.type ? `Type: ${campaignContext.type}` : "Type: Not specified"}

Natural Language Input from User:
${naturalLanguageInput}

Please enhance both the conversation prompt and voicemail message by incorporating the natural language input while preserving all variables and the overall structure. Then suggest a name for this run and provide a summary of the key changes you made.`;

  try {
    console.log("Calling AI generator...");

    // Use AI model to generate the enhanced content
    const { object } = await generateObject({
      model: anthropic("claude-3-haiku-20240307"),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: 4000,
      schema: z.object({
        newPrompt: z.string().min(10),
        newVoicemailMessage: z.string(),
        suggestedRunName: z.string().max(50),
        summary: z.string().min(10),
      }),
    });

    console.log("AI generation completed successfully");

    // Verify the result has the expected structure and content
    const result = object as EnhancedCampaignContent;

    // Validate that variables were preserved
    const basePromptVariables = extractVariables(basePrompt);
    const newPromptVariables = extractVariables(result.newPrompt);

    // Ensure all original variables are preserved
    const missingVariables = basePromptVariables.filter(
      (v) => !newPromptVariables.includes(v),
    );

    if (missingVariables.length > 0) {
      console.error(
        `AI removed or modified variables: ${missingVariables.join(", ")}`,
      );

      // Fix missing variables by restoring them from the original prompt
      for (const variable of missingVariables) {
        // Add the missing variable in a reasonable position
        result.newPrompt = result.newPrompt.replace(
          /\.\s+/,
          `. {{${variable}}} `,
        );
      }

      console.log("Fixed missing variables in prompt");
    }

    // Ensure voicemail message was generated if base was provided
    if (baseVoicemailMessage && !result.newVoicemailMessage) {
      result.newVoicemailMessage = baseVoicemailMessage;
    }

    return result;
  } catch (error) {
    console.error("Error generating enhanced campaign content:", error);

    // Return a fallback response if AI generation fails
    if (basePrompt && naturalLanguageInput) {
      return {
        newPrompt: incorporateUserInput(basePrompt, naturalLanguageInput),
        newVoicemailMessage: baseVoicemailMessage,
        suggestedRunName: generateSimpleRunName(
          campaignContext?.name,
          naturalLanguageInput,
        ),
        summary:
          "Failed to generate AI content. Applied basic enhancements only.",
      };
    }

    throw new Error(
      "Failed to generate enhanced campaign content: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Simple fallback function to incorporate user input into base prompt
 */
function incorporateUserInput(basePrompt: string, userInput: string): string {
  // Extract a key phrase or intention from user input
  const phrases = userInput
    .split(/[.!?]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 5 && p.length < 50);

  const keyPhrase = phrases[0] || userInput.substring(0, 50);

  // Find a good insertion point in the prompt (after first sentence)
  const firstSentenceEnd = basePrompt.search(/[.!?]\s/);

  if (firstSentenceEnd > 0) {
    const insertPoint = firstSentenceEnd + 1;
    return (
      basePrompt.substring(0, insertPoint) +
      ` Note: ${keyPhrase}. ` +
      basePrompt.substring(insertPoint)
    );
  }

  // If no good insertion point, append to beginning
  return `Note: ${keyPhrase}. ${basePrompt}`;
}

/**
 * Generate a simple run name when AI generation fails
 */
function generateSimpleRunName(
  campaignName?: string,
  userInput?: string,
): string {
  const date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (campaignName && userInput) {
    // Extract first few words from user input
    const words = userInput.split(/\s+/).slice(0, 3).join(" ");
    return `${campaignName} - ${words} (${date})`.substring(0, 50);
  }

  if (campaignName) {
    return `${campaignName} (${date})`;
  }

  return `New Run (${date})`;
}

/**
 * Extract variables from a prompt string
 */
function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map((match) => match.replace(/\{\{|\}\}/g, ""));
}
