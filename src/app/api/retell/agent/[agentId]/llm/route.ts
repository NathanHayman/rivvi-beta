import { env } from "@/env";
import { NextRequest, NextResponse } from "next/server";

const RETELL_BASE_URL = "https://api.retellai.com";

/**
 * API route handler for getting the LLM ID from an agent
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;

    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 },
      );
    }

    // Step 1: Get the agent details
    const response = await fetch(`${RETELL_BASE_URL}/get-agent/${agentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const agent = await response.json();

    // Step 2: Extract the LLM ID
    let llmId = null;
    if (agent.response_engine?.type === "retell-llm") {
      llmId = agent.response_engine.llm_id;
    } else {
      throw new Error("Agent does not use a Retell LLM");
    }

    return NextResponse.json({ llmId });
  } catch (error) {
    console.error("Error getting LLM ID from agent:", error);
    return NextResponse.json(
      {
        error: "Failed to get LLM ID from agent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
