import { env } from "@/env";
import { NextRequest, NextResponse } from "next/server";

const RETELL_BASE_URL = "https://api.retellai.com";

/**
 * API route handler for getting all Retell agents
 */
export async function GET(req: NextRequest) {
  try {
    // Make the request to Retell API
    const response = await fetch(`${RETELL_BASE_URL}/list-agents`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
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
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch agents",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
