import { uploadFile } from "@/server/actions/runs/file";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { runId: string } },
) {
  try {
    // Get runId from URL params
    const { runId } = await params;

    // Parse request body
    const body = await req.json();
    const { fileContent, fileName } = body;

    if (!fileContent || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields (fileContent or fileName)" },
        { status: 400 },
      );
    }

    // Call the server action with the data
    const result = await uploadFile({
      runId,
      fileContent,
      fileName,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in file upload API route:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "File upload failed",
      },
      { status: 500 },
    );
  }
}
