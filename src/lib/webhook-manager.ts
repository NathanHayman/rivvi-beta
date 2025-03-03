// src/lib/webhook-manager.ts
import {
  RetellAgentComplete,
  updateAgentWebhooks,
} from "@/lib/retell/retell-client-safe";
import { db } from "@/server/db";
import { campaigns } from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

/**
 * Configuration options for webhook management
 */
export interface WebhookConfigOptions {
  baseUrl?: string;
  setInbound?: boolean;
  setPostCall?: boolean;
  updateRetell?: boolean;
  updateDatabase?: boolean;
}

/**
 * Configure webhooks for a campaign
 * This updates both the Retell agent and records the URLs in the database
 * ! THIS IS NOT BEING USED RIGHT NOW
 */
export async function configureCampaignWebhooks(
  campaignId: string,
  options: WebhookConfigOptions = {},
) {
  try {
    // Set defaults
    const {
      baseUrl = process.env.API_URL || "https://api.rivvi.ai",
      setInbound = true,
      setPostCall = true,
      updateRetell = true,
      updateDatabase = true,
    } = options;

    // 1. Get the campaign details
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));

    if (!campaign) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Campaign not found",
      });
    }

    // 2. Generate webhook URLs
    const inboundUrl = `${baseUrl}/api/webhooks/retell/${campaign.orgId}/inbound`;
    const postCallUrl = `${baseUrl}/api/webhooks/retell/${campaign.orgId}/post-call/${campaignId}`;

    // 3. Store updated webhook URLs in the database if requested
    if (updateDatabase) {
      const webhookConfig = {
        ...campaign.config,
        webhooks: {
          inbound: setInbound ? inboundUrl : undefined,
          postCall: setPostCall ? postCallUrl : undefined,
        },
      };

      await db
        .update(campaigns)
        .set({ config: webhookConfig as any }) // Type assertion needed
        .where(eq(campaigns.id, campaignId));
    }

    // 4. Update Retell agent webhooks if requested
    if (updateRetell) {
      const isInbound = campaign.direction === "inbound";

      // Only set inbound webhook if campaign is inbound type
      const result = await updateAgentWebhooks(
        campaign.agentId,
        campaign.orgId,
        campaignId,
        {
          baseUrl,
          setInbound: setInbound && isInbound,
          setPostCall,
        },
      );

      return {
        success: true,
        campaign: campaign.id,
        webhooks: {
          inbound: isInbound && setInbound ? inboundUrl : null,
          postCall: setPostCall ? postCallUrl : null,
        },
        retellResult: result,
      };
    }

    return {
      success: true,
      campaign: campaign.id,
      webhooks: {
        inbound: setInbound ? inboundUrl : null,
        postCall: setPostCall ? postCallUrl : null,
      },
      retellResult: null,
    };
  } catch (error) {
    console.error("Error configuring campaign webhooks:", error);
    throw error;
  }
}

/**
 * Update webhook URLs in the LLM prompt
 * This is useful when migrating between environments or updating URLs
 * ! THIS IS NOT BEING USED RIGHT NOW
 */
export function updateWebhooksInPrompt(
  prompt: string,
  oldBaseUrl: string,
  newBaseUrl: string,
): string {
  // Replace all instances of the old base URL with the new one
  return prompt.replace(new RegExp(escapeRegExp(oldBaseUrl), "g"), newBaseUrl);
}

/**
 * Escape special characters for regex
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract webhook URLs from a prompt or configuration
 */
export function extractWebhooksFromPrompt(text: string): {
  inbound?: string;
  postCall?: string;
} {
  const result: { inbound?: string; postCall?: string } = {};

  // Find inbound webhook URL
  const inboundMatch = text.match(
    /inbound(_dynamic_variables)?_webhook_url\s*[=:]\s*["']?(https?:\/\/[^"'\s]+)["']?/i,
  );
  if (inboundMatch && inboundMatch[2]) {
    result.inbound = inboundMatch[2];
  }

  // Find post-call webhook URL
  const postCallMatch = text.match(
    /(?:post_call_webhook_url|webhook_url)\s*[=:]\s*["']?(https?:\/\/[^"'\s]+)["']?/i,
  );
  if (postCallMatch && postCallMatch[1]) {
    result.postCall = postCallMatch[1];
  }

  return result;
}

/**
 * Helper function to check if agent webhooks are properly configured
 */
export function checkAgentWebhooks(
  agent: RetellAgentComplete,
  orgId: string,
  campaignId?: string,
): {
  isConfigured: boolean;
  missingWebhooks: string[];
  expectedUrls: { inbound?: string; postCall?: string };
} {
  // Generate the expected URLs
  const baseUrl = process.env.API_URL || "https://api.rivvi.ai";
  const expectedInboundUrl = `${baseUrl}/api/webhooks/retell/${orgId}/inbound`;
  const expectedPostCallUrl = campaignId
    ? `${baseUrl}/api/webhooks/retell/${orgId}/post-call/${campaignId}`
    : `${baseUrl}/api/webhooks/retell/${orgId}/post-call`;

  const missingWebhooks: string[] = [];

  // Check inbound webhook (only if we have a place to check it)
  let hasInboundWebhook = false;
  if (agent.response_engine?.type === "retell-llm") {
    // This would need to be fetched from the LLM directly
    // For now, we'll assume it's not configured
    hasInboundWebhook = false;
    missingWebhooks.push("inbound");
  }

  // Check post-call webhook
  const hasPostCallWebhook = !!agent.webhook_url;
  if (!hasPostCallWebhook) {
    missingWebhooks.push("postCall");
  }

  return {
    isConfigured: missingWebhooks.length === 0,
    missingWebhooks,
    expectedUrls: {
      inbound: expectedInboundUrl,
      postCall: expectedPostCallUrl,
    },
  };
}
