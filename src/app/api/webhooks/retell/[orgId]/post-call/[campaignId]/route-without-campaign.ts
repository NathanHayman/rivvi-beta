// src/app/api/webhooks/retell/[orgId]/post-call/route-without-campaign.ts
import { handlePostCallWebhook } from "@/lib/retell/webhook-handlers";
import { RetellPostCallWebhookRaw } from "@/types/retell";
import { NextResponse } from "next/server";

export const maxDuration = 30; // 30 seconds for post-call processing

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

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

    // Log the incoming webhook for debugging
    console.log(
      `[API] Received post-call webhook for org ${orgId} (no campaign in URL):`,
      JSON.stringify({
        call_id: payload.call.call_id,
        direction: payload.call.direction,
        status: payload.call.call_status,
        metadata: payload.call.metadata,
      }),
    );

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

    // Try to get campaign ID from metadata
    const campaignId =
      callData.metadata?.campaignId || callData.metadata?.campaign_id || null;

    if (campaignId) {
      console.log(`[API] Using campaign ID from metadata: ${campaignId}`);
    } else {
      console.log(`[API] No campaign ID provided in URL or metadata`);
    }

    // Process the webhook using the handler
    const result = await handlePostCallWebhook(orgId, campaignId, callData);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Error processing Retell post-call webhook:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
