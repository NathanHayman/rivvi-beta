// src/app/api/webhooks/retell/[orgId]/inbound/route.ts
import { handleInboundWebhook } from "@/lib/webhook-handler";
import { NextResponse } from "next/server";

export const maxDuration = 10; // 10 seconds

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    // Parse the webhook payload
    const data = await request.json();

    // Validate the webhook has the necessary data
    if (!data.from_number) {
      return NextResponse.json({
        status: "error",
        error: "From number not provided",
        variables: {
          error_occurred: true,
          error_message: "Missing caller phone number",
        },
      });
    }

    // Check for agent_id in the payload
    if (!data.agent_id && data.llm_id) {
      // If llm_id is provided but agent_id is missing, use llm_id as a fallback
      // This is a temporary solution as Retell might be sending llm_id instead of agent_id
      data.agent_id = data.llm_id;
    }

    // If agent_id is still missing, provide a default value
    if (!data.agent_id) {
      data.agent_id = "default-inbound-agent";
      console.log(
        `Warning: No agent_id provided in webhook, using default value for org ${orgId}`,
      );
    }

    // Use the webhook handler to process the request
    const result = await handleInboundWebhook(orgId, data);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing inbound webhook:", error);

    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
        variables: {
          error_occurred: true,
          error_message: "Internal server error, please try again later",
        },
      },
      { status: 500 },
    );
  }
}
