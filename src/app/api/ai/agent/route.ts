import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { agentResponseSchema } from "./schema";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Validation schema for the incoming request
const requestSchema = z.object({
  basePrompt: z.string(),
  baseVoicemailMessage: z.string().optional(),
  naturalLanguageInput: z.string(),
  campaignContext: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      type: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

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

You need to generate highly structured data about the changes for A/B testing analysis, including:

1. A unique variation ID
2. Detailed metadata about the changes (categories, tags, tone shift, etc.)
3. Analysis of the changes including:
   - The inferred intent behind the user's requested changes
   - Sentiment and formality level changes 
   - Complexity score changes
4. A clear summary and suggested run name
5. Comparison data breaking down:
   - Structural changes by section (intro, body, closing, etc.)
   - Key phrases added, removed, or modified
   - Performance prediction with expected impact
6. Word-by-word diff data for both the prompt and voicemail message

The user will not see the actual prompt, so make sure your metadata and analysis are comprehensive.

FOR THE DIFF DATA: Break the text into words/phrases and classify each as "unchanged", "added", or "removed".
Example diff:
[
  { "type": "unchanged", "value": "This is " },
  { "type": "removed", "value": "old text" },
  { "type": "added", "value": "new text" },
  { "type": "unchanged", "value": " that continues." }
]`;

    // Create the stream with OpenAI using streamObject
    const stream = streamObject({
      model: openai("gpt-4-turbo"),
      schema: agentResponseSchema,
      prompt: systemPrompt,
      temperature: 0.7,
      maxTokens: 3000,
      schemaName: "agentResponseSchema",
      schemaDescription: "Agent response schema",
    });

    // Return the streaming response for consumption by the useObject hook
    return stream.toTextStreamResponse();
  } catch (error) {
    console.error("Error in AI generation API:", error);

    // Return appropriate error response
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 400 },
    );
  }
}
