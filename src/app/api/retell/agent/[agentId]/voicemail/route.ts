import { env } from "@/env";
import { NextRequest, NextResponse } from "next/server";

const RETELL_BASE_URL = "https://api.retellai.com";

/**
 * API route handler for updating agent voicemail message
 */
export async function POST(
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

    // Get the data from the request body
    const body = await req.json();
    const { voicemailMessage } = body;

    if (!voicemailMessage) {
      return NextResponse.json(
        { error: "Voicemail message is required" },
        { status: 400 },
      );
    }

    // Update the agent voicemail message
    const response = await fetch(`${RETELL_BASE_URL}/update-agent/${agentId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ voicemail_message: voicemailMessage }),
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
    console.error("Error updating agent voicemail:", error);
    return NextResponse.json(
      {
        error: "Failed to update agent voicemail",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
