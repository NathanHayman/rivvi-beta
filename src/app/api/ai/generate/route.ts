import { generateEnhancedCampaignContent } from "@/services/ai/generator";
import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const validatedData = generateRequestSchema.parse(body);

    // Call the generator function with validated data
    const result = await generateEnhancedCampaignContent(
      validatedData.basePrompt,
      validatedData.baseVoicemailMessage || "",
      validatedData.naturalLanguageInput,
      validatedData.campaignContext,
    );

    // Return the result
    return NextResponse.json(result);
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
