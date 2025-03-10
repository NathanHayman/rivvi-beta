import { convertPostCallToAnalysisFields } from "@/server/actions/retell/utils";
import { NextRequest, NextResponse } from "next/server";

/**
 * API route handler for converting post-call analysis data to analysis fields
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (!data || !Array.isArray(data)) {
      return NextResponse.json(
        { error: "Invalid post-call data format" },
        { status: 400 },
      );
    }

    // Convert the post-call data to analysis fields
    const analysisFields = await convertPostCallToAnalysisFields(data);

    return NextResponse.json(analysisFields);
  } catch (error) {
    console.error("Error converting post-call analysis data:", error);
    return NextResponse.json(
      {
        error: "Failed to convert post-call analysis data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
