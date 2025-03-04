import { getRetellAgentComplete } from "@/lib/retell/retell-actions";
import { NextRequest, NextResponse } from "next/server";

/**
 * API route handler for getting complete agent information
 * including agent details, LLM information, and combined data
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

    // Use the server action to get complete agent info
    const agentComplete = await getRetellAgentComplete(agentId);

    return NextResponse.json(agentComplete);
  } catch (error) {
    console.error("Error fetching complete agent info:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch complete agent info",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
