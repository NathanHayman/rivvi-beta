"use server";

import { z } from "zod";

// Input validation schema
const generateRequestSchema = z.object({
  basePrompt: z.string().min(10, "Base prompt must be at least 10 characters"),
  baseVoicemailMessage: z.string().optional(),
  naturalLanguageInput: z
    .string()
    .min(5, "Input must be at least 5 characters"),
  campaignContext: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      type: z.string().optional(),
    })
    .optional(),
});

export type GenerateAgentRequest = z.infer<typeof generateRequestSchema>;

/**
 * NOTE: This server action is now DEPRECATED.
 * Please use the API route at /api/ai/agent directly for better streaming support.
 * This is maintained for backwards compatibility only.
 *
 * Server action to generate AI agent prompt based on natural language input
 * with streaming support using Vercel AI SDK
 */
export async function generateAgentPromptAction(data: GenerateAgentRequest) {
  try {
    // Validate the input data
    const validatedData = generateRequestSchema.parse(data);

    console.warn(
      "DEPRECATED: Using server action for AI generation. Please use the API route instead.",
    );

    // Format the context for the prompt
    const campaignContext = validatedData.campaignContext
      ? `Campaign Name: ${validatedData.campaignContext.name || "N/A"}\n` +
        `Campaign Description: ${validatedData.campaignContext.description || "N/A"}\n` +
        `Campaign Type: ${validatedData.campaignContext.type || "N/A"}\n`
      : "";

    // Create a comprehensive prompt that includes all required information
    const systemPrompt = `You are an expert AI prompt engineer specializing in refining voice AI scripts.
Your task is to take a base prompt, a voicemail message, and natural language input, and create an improved version.

BASE PROMPT:
${validatedData.basePrompt}

VOICEMAIL MESSAGE:
${validatedData.baseVoicemailMessage || ""}

USER'S NATURAL LANGUAGE INPUT:
${validatedData.naturalLanguageInput}

${campaignContext ? `ADDITIONAL CONTEXT:\n${campaignContext}` : ""}

Based on the user's natural language input, generate:
1. An improved version of the base prompt
2. An improved version of the voicemail message (if one was provided)
3. A concise summary of your changes
4. Metadata including categories, tags, key changes, tone shift, and focus area
5. A suggested name for this run based on the changes

The user will not see the actual prompt, so make sure your summary and metadata are comprehensive.`;

    // Create direct response without streaming
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    // Parse JSON from the content
    const content = result.choices[0]?.message?.content || "{}";
    let parsedContent;

    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse JSON response:", e);
      parsedContent = { error: "Failed to parse AI response" };
    }

    return parsedContent;
  } catch (error) {
    console.error("Error in AI generation:", error);
    throw error;
  }
}
