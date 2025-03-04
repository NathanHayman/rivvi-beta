import { updateRetellAgentWebhooks } from "@/lib/retell/retell-actions";
import { NextRequest, NextResponse } from "next/server";

/**
 * API route handler for updating agent webhooks
 */
export async function POST(
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

    // Get the data from the request body
    const body = await req.json();
    const { updateData, orgId, campaignId } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 },
      );
    }

    // Use the server action to update webhooks
    const options = {
      baseUrl: body.baseUrl,
      setInbound:
        updateData.inbound_dynamic_variables_webhook_url !== undefined,
      setPostCall: updateData.webhook_url !== undefined,
    };

    const result = await updateRetellAgentWebhooks(
      agentId,
      orgId,
      campaignId,
      options,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating agent webhooks:", error);
    return NextResponse.json(
      {
        error: "Failed to update agent webhooks",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
