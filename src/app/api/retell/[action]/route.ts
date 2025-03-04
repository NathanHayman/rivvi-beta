// src/app/api/retell/[action]/route.ts
import { env } from "@/env";
import { NextRequest, NextResponse } from "next/server";

const RETELL_BASE_URL = "https://api.retellai.com";

/**
 * API route handler for Retell operations
 * This provides a secure way to access Retell API using server-side environment variables
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  const { searchParams } = new URL(req.url);
  const body = await req.json();

  try {
    // Validate the action
    if (
      ![
        "get-agent",
        "get-llm",
        "update-agent",
        "update-llm",
        "get-agents",
      ].includes(action)
    ) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    let url: string;
    let method = "GET";

    // Determine the Retell API endpoint based on the action
    switch (action) {
      case "get-agents":
        url = `${RETELL_BASE_URL}/get-agents`;
        method = "GET";
        break;

      case "get-agent":
        const agentId = body.agentId || searchParams.get("agentId");
        if (!agentId) {
          return NextResponse.json(
            { error: "Agent ID is required" },
            { status: 400 },
          );
        }
        url = `${RETELL_BASE_URL}/get-agent/${agentId}`;
        break;

      case "get-llm":
        const llmId = body.llmId || searchParams.get("llmId");
        if (!llmId) {
          return NextResponse.json(
            { error: "LLM ID is required" },
            { status: 400 },
          );
        }
        url = `${RETELL_BASE_URL}/get-retell-llm/${llmId}`;
        break;

      case "update-agent":
        const updateAgentId = body.agentId || searchParams.get("agentId");
        if (!updateAgentId) {
          return NextResponse.json(
            { error: "Agent ID is required" },
            { status: 400 },
          );
        }
        url = `${RETELL_BASE_URL}/update-agent/${updateAgentId}`;
        method = "POST";
        break;

      case "update-llm":
        const updateLlmId = body.llmId || searchParams.get("llmId");
        if (!updateLlmId) {
          return NextResponse.json(
            { error: "LLM ID is required" },
            { status: 400 },
          );
        }
        url = `${RETELL_BASE_URL}/update-retell-llm/${updateLlmId}`;
        method = "POST";
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Make the request to Retell API
    const payload = method === "POST" ? body.data || {} : undefined;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${env.RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      ...(payload && { body: JSON.stringify(payload) }),
    });

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
    console.error("Error in Retell API route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// Also support GET requests for agent and LLM info
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  const { searchParams } = new URL(req.url);

  // For GET requests, create a compatible body format
  const body = {
    agentId: searchParams.get("agentId"),
    llmId: searchParams.get("llmId"),
  };

  // Reuse the POST handler logic
  return POST(
    new NextRequest(req.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params },
  );
}
