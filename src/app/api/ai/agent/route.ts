import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { agentResponseSchema } from "./schema";

// Allow streaming responses up to 120 seconds for complex prompt engineering
export const maxDuration = 120;

// Enhanced validation schema with detailed errors
const requestSchema = z.object({
  basePrompt: z
    .string()
    .min(10, "Base prompt is required and must be substantial"),
  baseVoicemailMessage: z.string().optional(),
  naturalLanguageInput: z.string().min(5, "Natural language input is required"),
  campaignContext: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      type: z.string().optional(),
      targetAudience: z.string().optional(),
      primaryGoal: z.string().optional(),
      secondaryGoals: z.array(z.string()).optional(),
      brandVoice: z.string().optional(),
      complianceRequirements: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    // Measure initial lengths for metadata
    const originalPromptLength = validatedData.basePrompt.length;
    const originalVoicemailLength =
      validatedData.baseVoicemailMessage?.length || 0;

    // Generate a unique timestamp ID for this variation
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .slice(0, 14);

    // Extract campaign name for variation ID creation
    const campaignShortName = validatedData.campaignContext?.name
      ? validatedData.campaignContext.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .slice(0, 12)
      : "general";

    // Format the context for the prompt in a more structured way
    const campaignContext = validatedData.campaignContext
      ? `# CAMPAIGN CONTEXT
Campaign Name: ${validatedData.campaignContext.name || "N/A"}
Campaign Description: ${validatedData.campaignContext.description || "N/A"}
`
      : "# CAMPAIGN CONTEXT\nNo specific campaign details provided.";

    // Create a comprehensive prompt that includes all required information
    const systemPrompt = `# EXPERT HEALTHCARE VOICE AI PROMPT ENGINEERING SYSTEM

## YOUR ROLE AND EXPERTISE
You are SEMG-PromptCraft™, an expert AI prompt engineer with specialized knowledge in:
- Healthcare communication protocols
- HIPAA compliance requirements
- Voice AI conversation design
- Patient engagement best practices
- Medical terminology and pronunciation guidelines
- Call flow optimization for healthcare
- Sentiment calibration for medical contexts

## YOUR TASK
Transform a base voice AI prompt and voicemail message according to the campaign context and user's natural language input, while preserving the original structure, syntax, and technical elements.

## CRITICAL REQUIREMENTS

### STRUCTURE PRESERVATION
- Maintain ALL section headers exactly as they appear
- Keep ALL function calls with identical syntax (e.g., \`end_call\`, \`transfer_to_scheduling\`)
- Preserve phone number format: "seven seven zero - six two six - five six zero seven"
- Variables must follow format {{variable_name}} and can only be renamed if purpose changes
- Maintain or increase the depth of instructions in each section

### HEALTHCARE COMPLIANCE
- All content must maintain strict HIPAA compliance
- No specific medical details in voicemails or with unauthorized persons
- Verification protocols for patient identity must be preserved
- Follow Southeast Medical Group's established guidelines for information handling

### VOICE AI OPTIMIZATIONS
- Maintain natural, conversational language
- Ensure speech-friendly formatting (avoid characters that may cause TTS issues)
- Include pause indicators and emphasis where appropriate
- Provide alternate pronunciation guidance for medical terms
- Maintain time-efficient dialogue paths

## DETAILED ANALYSIS REQUIREMENTS
Generate comprehensive metadata that would allow for robust A/B testing, including:

1. **VARIATION IDENTIFICATION**
   - Create unique ID: "${campaignShortName}-${timestamp}"
   - Ensure traceability to original campaign

2. **METADATA CATEGORIZATION**
   - Include healthcare-specific categories and tags
   - Identify patient journey touchpoints affected
   - Map to established voice AI patterns

3. **CHANGE ANALYSIS**
   - Document precise purpose shifts
   - Analyze both semantic and functional changes
   - Evaluate compliance implications
   - Measure changes in conversation density
   - Assess psychological framing differences

4. **COMPARATIVE METRICS**
   - Detailed before/after quantitative measures:
     * Sentiment polarity (negative to positive scale)
     * Formality level (1-10 scale)
     * Complexity score (1-10 scale)
     * Directness rating (1-10 scale)
     * Word efficiency ratio
     * Estimated time-to-completion delta

5. **PERFORMANCE PREDICTION**
   - Predict patient engagement impact
   - Identify potential friction points
   - Evaluate comprehension challenges
   - Assess alignment with campaign goals

## INPUT MATERIALS

### BASE PROMPT:
\`\`\`
${validatedData.basePrompt}
\`\`\`

### BASE VOICEMAIL MESSAGE:
\`\`\`
${validatedData.baseVoicemailMessage || "No voicemail message provided."}
\`\`\`

### USER'S NATURAL LANGUAGE INPUT:
\`\`\`
${validatedData.naturalLanguageInput}
\`\`\`

${campaignContext}

## OUTPUT REQUIREMENTS

### COMPLETE DELIVERABLES
You MUST deliver:
1. A complete, non-truncated prompt (min ${originalPromptLength} characters)
2. A complete, non-truncated voicemail message (min ${originalVoicemailLength} characters)
3. Comprehensive analysis data structured according to the schema

### DIFF DATA SPECIFICATIONS
For both prompt and voicemail message, create precise diff data:
- Break text into logical semantic units (not arbitrary word breaks)
- Classify each unit as "unchanged", "added", or "removed"
- Maintain exact formatting within diff units

Example diff:
[
  { "type": "unchanged", "value": "This is " },
  { "type": "removed", "value": "old text" },
  { "type": "added", "value": "new text" },
  { "type": "unchanged", "value": " that continues." }
]

## QUALITY CHECKLIST

Before submission, verify your response meets all these criteria:
- ✓ Complete prompt and voicemail text with no truncation
- ✓ All function calls preserved with exact syntax
- ✓ HIPAA compliance maintained throughout
- ✓ All variable references properly formatted
- ✓ Speech-optimized formatting throughout
- ✓ No contradictions between sections
- ✓ Call flow logic remains coherent
- ✓ Error handling pathways preserved
- ✓ Complete diff data with proper formatting
- ✓ All metadata fields properly populated
- ✓ Format follows schema exactly

Attention to detail in your engineering will directly impact patient care quality and medical outcomes. This is a critical healthcare communication system.`;

    // Use the more capable model and lower temperature for precision
    const stream = streamObject({
      model: openai("gpt-4o"),
      schema: agentResponseSchema,
      prompt: systemPrompt,
      temperature: 0.3, // Reduced for maximum precision and consistency
      maxTokens: 6000, // Increased to handle complex prompts and analysis
      schemaName: "agentResponseSchema",
      schemaDescription:
        "Comprehensive healthcare voice AI prompt transformation schema",
      frequencyPenalty: 0.2, // Adds variety to phrasings
      presencePenalty: 0.3, // Prevents repetition
    });

    // Add timing for analytics
    const startTime = Date.now();

    // Return streaming response with added headers for debugging
    const response = await stream.toTextStreamResponse();

    // Add execution metrics to response headers
    response.headers.set("X-Processing-Time", `${Date.now() - startTime}ms`);
    response.headers.set("X-Prompt-Length", `${systemPrompt.length}`);
    response.headers.set("X-Variation-ID", `${campaignShortName}-${timestamp}`);

    return response;
  } catch (error) {
    console.error("Error in AI prompt engineering API:", error);

    // Enhanced structured error response
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === "development" ? error.stack : undefined,
            validation:
              error instanceof z.ZodError ? error.format() : undefined,
          }
        : { message: "Unknown error occurred" };

    // Return appropriate error response with diagnostics
    return NextResponse.json(
      {
        error: errorDetails,
        timestamp: new Date().toISOString(),
        success: false,
        request_id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      },
      {
        status: error instanceof z.ZodError ? 400 : 500,
        headers: {
          "X-Error-Type":
            error instanceof z.ZodError ? "validation" : "processing",
        },
      },
    );
  }
}
