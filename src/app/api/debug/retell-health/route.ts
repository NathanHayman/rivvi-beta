import { healthCheck } from "@/lib/retell-client-safe";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("[DEBUG] Starting Retell health check");

    // Run the health check
    const result = await healthCheck();

    console.log(
      `[DEBUG] Health check complete: ${result.success ? "Success" : "Failed"}`,
    );

    // Return the result with appropriate status code
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    console.error("[DEBUG] Failed to run Retell health check:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to perform health check",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      {
        status: 500,
      },
    );
  }
}
