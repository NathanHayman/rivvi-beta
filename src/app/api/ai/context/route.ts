import { generateContextInstructions } from "@/services/out/ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Input validation schema
const contextRequestSchema = z.object({
  context: z.record(z.any()),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const validatedData = contextRequestSchema.parse(body);

    // Call the generator function with validated data
    const result = await generateContextInstructions(validatedData.context);

    // Return the result
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in AI context generation API:", error);

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
