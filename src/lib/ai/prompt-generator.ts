// src/lib/ai/prompt-generator.ts
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
1. A new prompt based on the base prompt
2. A new voicemail message based on the base voicemail message
3. A suggested name for the run that is descriptive but concise
4. A summary explaining the key changes you made to both the prompt and voicemail message`;

  const userPrompt = `Base Prompt for Live Conversation:
${basePrompt}

Base Voicemail Message:
${baseVoicemailMessage}

Campaign Context:
${campaignContext?.name ? `Name: ${campaignContext.name}` : ""}
${campaignContext?.description ? `Description: ${campaignContext.description}` : ""}
${campaignContext?.type ? `Type: ${campaignContext.type}` : ""}

Natural Language Input from User:
${naturalLanguageInput}

Please enhance both the conversation prompt and voicemail message by incorporating the natural language input while preserving all variables and the overall structure. Then suggest a name for this run and provide a summary of the key changes you made.`;

  try {
    const { object } = await generateObject({
      model: anthropic("claude-3-haiku-20240307"),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: 4000,
      schema: z.object({
        newPrompt: z.string(),
        newVoicemailMessage: z.string(),
        suggestedRunName: z.string(),
        summary: z.string(),
      }),
    });

    return object as EnhancedCampaignContent;
  } catch (error) {
    console.error("Error generating enhanced campaign content:", error);
    throw new Error("Failed to generate enhanced campaign content");
  }
}
