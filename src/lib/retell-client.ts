// src/lib/retell-client.ts
import { env } from "@/env";
import { Retell } from "retell-sdk";

// Ensure API key is set in environment
if (!env.RETELL_API_KEY) {
  throw new Error("RETELL_API_KEY is not set in environment variables");
}

// Create the Retell API client
export const retell = new Retell({
  apiKey: env.RETELL_API_KEY,
});

/**
 * Get all agents from Retell
 */
export const getAgents = async () => {
  try {
    // Use fetch directly to avoid SDK issues with Turbopack
    const response = await fetch("https://api.retellai.com/list-agents", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Retell API error: ${response.status} ${response.statusText}`,
      );
    }

    console.log("Agents:", response);
    return response.json();
  } catch (error) {
    console.error("Error fetching agents:", error);
    throw error;
  }
};

/**
 * Get a single agent from Retell
 */
export const getAgent = async (agentId: string) => {
  try {
    console.log("Getting agent:", agentId);

    // Use fetch directly to avoid SDK issues with Turbopack
    const response = await fetch(
      `https://api.retellai.com/get-agent/${agentId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Retell API error: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting agent:", error);
    throw error;
  }
};

/**
 * Updates the prompt for a Retell agent
 */
export const updateAgentPrompt = async (agentId: string, prompt: string) => {
  try {
    const agent = await retell.agent.retrieve(agentId);
    const llmId =
      agent.response_engine.type === "retell-llm"
        ? agent.response_engine.llm_id
        : null;
    if (!llmId) {
      throw new Error("Agent does not use an LLM");
    }
    const result = await retell.llm.update(llmId, {
      general_prompt: prompt,
    });

    return result;
  } catch (error) {
    console.error("Error updating agent prompt:", error);
    throw error;
  }
};

/**
 * Configure webhooks for an agent
 */
export const configureAgentWebhooks = async (
  agentId: string,
  options: {
    inboundOrgId?: string;
    postCallEnabled?: boolean;
    baseUrl?: string;
  },
) => {
  const {
    inboundOrgId,
    postCallEnabled,
    baseUrl = process.env.API_URL || "https://api.rivvi.ai",
  } = options;

  const updateData: Record<string, unknown> = {};

  // Configure inbound webhook if org ID is provided
  if (inboundOrgId) {
    updateData.inbound_dynamic_variables_webhook_url = `${baseUrl}/api/webhooks/retell/${inboundOrgId}/inbound`;
  }

  // Configure post-call webhook if enabled
  if (postCallEnabled) {
    updateData.post_call_webhook_url = `${baseUrl}/api/webhooks/retell/${inboundOrgId}/post-call/${agentId}`;
  }

  // Update the agent if we have data to update
  if (Object.keys(updateData).length > 0) {
    try {
      const agent = await retell.agent.update(agentId, updateData);

      return agent;
    } catch (error) {
      console.error("Error configuring agent webhooks:", error);
      throw error;
    }
  }

  return { message: "No changes to apply" };
};

/**
 * Create a phone call using Retell
 */
export const createPhoneCall = async (params: {
  toNumber: string;
  fromNumber: string;
  agentId: string;
  variables: Record<string, unknown>;
  metadata: Record<string, unknown>;
}) => {
  const { toNumber, fromNumber, agentId, variables, metadata } = params;

  try {
    const call = await retell.call.createPhoneCall({
      to_number: toNumber,
      from_number: fromNumber,
      override_agent_id: agentId,
      retell_llm_dynamic_variables: variables,
      metadata,
    });

    return call;
  } catch (error) {
    console.error("Error creating phone call:", error);
    throw error;
  }
};

/**
 * Get call information from Retell
 */
export const getCallInfo = async (callId: string) => {
  try {
    const call = await retell.call.retrieve(callId);

    return call;
  } catch (error) {
    console.error("Error getting call info:", error);
    throw error;
  }
};
