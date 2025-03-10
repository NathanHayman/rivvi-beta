import { uploadFile } from "@/server/actions/runs/file";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    // Get runId from URL params
    const { runId } = await params;

    // Parse request body
    const body = await req.json();
    console.log("body", body);
    const { fileContent, fileName, processedData } = body;

    if (!fileContent || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields (fileContent or fileName)" },
        { status: 400 },
      );
    }

    // Call the server action with the data
    const payload = {
      runId,
      fileContent,
      fileName,
    };

    // Add processedData if available
    if (processedData) {
      Object.assign(payload, { processedData });
    }

    const result = await uploadFile(payload);

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
