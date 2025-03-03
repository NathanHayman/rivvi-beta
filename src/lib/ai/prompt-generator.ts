import anthropic from "@/lib/anthropic";
import { generateObject, generateText } from "ai";
import { z } from "zod";

/**
 * Generates a prompt for a voice AI agent based on natural language input and a base prompt
 *
 * @param basePrompt The base prompt template for the campaign
 * @param naturalLanguageInput The user's natural language description of what they want to achieve
 * @param campaignContext Additional context about the campaign (optional)
 * @returns The generated prompt
 */
export async function generatePromptFromNaturalLanguage(
  basePrompt: string,
  naturalLanguageInput: string,
  campaignContext?: {
    name?: string;
    description?: string;
  },
) {
  try {
    const systemPrompt = `You are an expert AI prompt engineer specializing in voice AI conversations for healthcare communications.
Your task is to enhance a base prompt with natural language input from a user, while preserving the core structure and variables of the base prompt.

The base prompt contains special variables in the format {{variableName}} that must be preserved exactly as they appear.
You must never remove, modify, or add new variables.

Guidelines:
1. Maintain all existing variables in the {{variableName}} format
2. Preserve the overall structure and flow of the base prompt
3. Incorporate the user's natural language input to enhance the prompt's tone, style, and effectiveness
4. Ensure the prompt remains conversational and natural for voice AI
5. Keep healthcare-specific language and context appropriate
6. Do not add technical instructions or formatting that would confuse a voice AI system

Your output should be ONLY the enhanced prompt text, with no explanations or additional commentary.`;

    const userPrompt = `Base Prompt:
${basePrompt}

Campaign Context:
${campaignContext?.name ? `Name: ${campaignContext.name}` : ""}
${campaignContext?.description ? `Description: ${campaignContext.description}` : ""}

Natural Language Input:
${naturalLanguageInput}

Please enhance the base prompt by incorporating the natural language input while preserving all variables and the overall structure.`;

    const { text } = await generateText({
      model: anthropic("claude-3-haiku-20240307"),
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.7,
      maxTokens: 2000,
    });

    return text.trim();
  } catch (error) {
    console.error("Error generating prompt:", error);
    throw new Error("Failed to generate prompt from natural language input");
  }
}

/**
 * Output schema for the enhanced campaign content
 */
export type EnhancedCampaignContent = {
  newPrompt: string;
  newVoicemailMessage: string;
  summary: string;
};

/**
 * Generates enhanced campaign content (prompt and voicemail) based on natural language input
 * Can stream the results in real-time
 *
 * @param basePrompt The base prompt template for the campaign
 * @param baseVoicemailMessage The base voicemail message template
 * @param naturalLanguageInput The user's natural language description of what they want to achieve
 * @param campaignContext Additional context about the campaign (optional)
 * @param streaming Whether to stream the results or return the complete object
 * @returns A stream of the enhanced campaign content object or the complete object
 */
export async function generateEnhancedCampaignContent(
  basePrompt: string,
  baseVoicemailMessage: string,
  naturalLanguageInput: string,
  campaignContext?: {
    name?: string;
    description?: string;
  },
  streaming: boolean = true,
) {
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

You must generate ALL three required outputs:
1. A new prompt based on the base prompt
2. A new voicemail message based on the base voicemail message
3. A summary explaining the key changes you made to both

Remember that these communications are for voice interactions in a healthcare context, so clarity, empathy, and professionalism are essential.`;

  const userPrompt = `Base Prompt for Live Conversation:
${basePrompt}

Base Voicemail Message:
${baseVoicemailMessage}

Campaign Context:
${campaignContext?.name ? `Name: ${campaignContext.name}` : ""}
${campaignContext?.description ? `Description: ${campaignContext.description}` : ""}

Natural Language Input from User:
${naturalLanguageInput}

Please enhance both the conversation prompt and voicemail message by incorporating the natural language input while preserving all variables and the overall structure. Then provide a summary of the key changes you made.`;

  try {
    // Return the complete object at once
    const { object } = await generateObject({
      model: anthropic("claude-3-haiku-20240307"),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: 4000,
      schema: z.object({
        newPrompt: z.string(),
        newVoicemailMessage: z.string(),
        summary: z.string(),
      }),
    });

    return object as EnhancedCampaignContent;
  } catch (error) {
    console.error("Error generating enhanced campaign content:", error);
    throw new Error("Failed to generate enhanced campaign content");
  }
}
