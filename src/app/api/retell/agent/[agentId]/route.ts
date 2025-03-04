import { getRetellAgent } from "@/lib/retell/retell-actions";
import { NextRequest, NextResponse } from "next/server";

/**
 * API route handler for getting a single Retell agent
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

    // Use the server action to get the agent
    const agent = await getRetellAgent(agentId);

    return NextResponse.json(agent);
  } catch (error) {
    console.error("Error fetching agent:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch agent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
