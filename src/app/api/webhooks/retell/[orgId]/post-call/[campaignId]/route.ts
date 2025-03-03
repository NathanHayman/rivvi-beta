// src/app/api/webhooks/retell/[orgId]/post-call/route.ts
import { handlePostCallWebhook } from "@/lib/call/call-webhook-handler";
import { RetellPostCallWebhookRaw } from "@/types/retell";
import { NextResponse } from "next/server";

export const maxDuration = 30; // 30 seconds for post-call processing

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string; campaignId: string }> },
) {
  try {
    const { orgId, campaignId } = await params;

    // Parse the webhook payload
    const payload = (await request.json()) as RetellPostCallWebhookRaw["body"];

    // Skip processing if this is not a call_analyzed event
    if (
      payload.event !== "call_analyzed" ||
      payload.call.call_type !== "phone_call"
    ) {
      return NextResponse.json(
        {
          status: "ignored",
          message: "Not a call_analyzed event",
        },
        { status: 200 },
      );
    }

    // Extract the call data from the nested structure
    const callData = payload.call;

    // Validate the webhook has the necessary data
    if (!callData?.call_id) {
      return NextResponse.json(
        {
          status: "error",
          error: "Call ID not provided",
        },
        { status: 400 },
      );
    }

    // Process the webhook using the handler
    const result = await handlePostCallWebhook(orgId, campaignId, callData);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing Retell post-call webhook:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
