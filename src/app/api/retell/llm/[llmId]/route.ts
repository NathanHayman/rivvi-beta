import { env } from "@/env";
import { getRetellLlm } from "@/lib/retell/retell-actions";
import { NextRequest, NextResponse } from "next/server";

const RETELL_BASE_URL = "https://api.retellai.com";

/**
 * API route handler for getting LLM details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ llmId: string }> },
) {
  try {
    const { llmId } = await params;

    if (!llmId) {
      return NextResponse.json(
        { error: "LLM ID is required" },
        { status: 400 },
      );
    }

    // Use the server action to get the LLM
    const llm = await getRetellLlm(llmId);

    return NextResponse.json(llm);
  } catch (error) {
    console.error("Error fetching LLM:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch LLM",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * API route handler for updating LLM prompt
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ llmId: string }> },
) {
  try {
    const { llmId } = await params;

    if (!llmId) {
      return NextResponse.json(
        { error: "LLM ID is required" },
        { status: 400 },
      );
    }

    // Get the prompt from the request body
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    // Update the LLM prompt
    const response = await fetch(
      `${RETELL_BASE_URL}/update-retell-llm/${llmId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ general_prompt: prompt }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Retell API error (${response.status}): ${errorText}`);
      return NextResponse.json(
        { error: `Retell API error: ${response.status}`, details: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating LLM prompt:", error);
    return NextResponse.json(
      {
        error: "Failed to update LLM prompt",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
