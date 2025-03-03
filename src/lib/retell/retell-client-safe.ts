// src/lib/retell-client-safe.ts
/**
 * Client-safe Retell integration that uses server-side API routes
 * This avoids exposing API keys in client-side code
 */

/**
 * Type definitions for Retell API responses
 */
export type RetellAgentComplete = {
  agent_id: string;
  agent_name: string;
  response_engine: {
    type: string;
    llm_id: string;
  };
  webhook_url?: string;
  voicemail_message?: string;
  post_call_analysis_data?: Array<{
    type: string;
    name: string;
    description: string;
    choices?: string[];
    examples?: string[];
  }>;
};

export type RetellLlmComplete = {
  llm_id: string;
  general_prompt: string;
  inbound_dynamic_variables_webhook_url?: string;
};

export type RetellAgentCombined = {
  agent: RetellAgentComplete;
  llm: RetellLlmComplete;
  combined: {
    agent_id: string;
    agent_name: string;
    llm_id: string;
    general_prompt: string;
    voicemail_message?: string;
    post_call_analysis_data?: Array<{
      type: string;
      name: string;
      description: string;
      choices?: string[];
      examples?: string[];
    }>;
    webhook_url?: string;
    inbound_dynamic_variables_webhook_url?: string;
  };
};

/**
 * Get complete agent information including LLM in one call
 */
export const getAgentComplete = async (
  agentId: string,
): Promise<RetellAgentCombined> => {
  try {
    console.log("Getting complete agent info for:", agentId);

    // Step 1: Get the agent details
    const agent = await getAgent(agentId);

    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Step 2: Extract the LLM ID and fetch LLM details
    let llmId = null;
    if (agent.response_engine?.type === "retell-llm") {
      llmId = agent.response_engine.llm_id;
    } else {
      throw new Error("Agent does not use a Retell LLM");
    }

    const llm = await getLlm(llmId);

    // Step 3: Combine the data into a single structure
    const combined = {
      agent_id: agent.agent_id,
      agent_name: agent.agent_name,
      llm_id: llm.llm_id,
      general_prompt: llm.general_prompt,
      voicemail_message: agent.voicemail_message,
      post_call_analysis_data: agent.post_call_analysis_data,
      webhook_url: agent.webhook_url,
      inbound_dynamic_variables_webhook_url:
        llm.inbound_dynamic_variables_webhook_url,
    };

    return {
      agent,
      llm,
      combined,
    };
  } catch (error) {
    console.error("Error getting complete agent info:", error);
    throw error;
  }
};

/**
 * Get a single agent from Retell (client-safe)
 */
export const getAgent = async (
  agentId: string,
): Promise<RetellAgentComplete> => {
  try {
    console.log("Getting agent:", agentId);

    const response = await fetch(`/api/retell/get-agent?agentId=${agentId}`);

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
 * Get all agents from Retell (client-safe)
 */
export const getAgents = async (): Promise<
  Pick<RetellAgentComplete, "agent_id" | "agent_name">[]
> => {
  try {
    const response = await fetch("/api/retell/get-agents");

    if (!response.ok) {
      throw new Error(
        `Retell API error: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting agents:", error);
    throw error;
  }
};

/**
 * Get LLM details from Retell (client-safe)
 */
export const getLlm = async (llmId: string): Promise<RetellLlmComplete> => {
  try {
    console.log("Getting LLM:", llmId);

    const response = await fetch(`/api/retell/get-llm?llmId=${llmId}`);

    if (!response.ok) {
      throw new Error(
        `Retell API error: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting LLM:", error);
    throw error;
  }
};

/**
 * Generate consistent webhook URLs for Retell integration
 */
export const generateWebhookUrls = (
  baseUrl: string,
  orgId: string,
  campaignId?: string,
) => {
  // Base URL fallback
  const apiBaseUrl = baseUrl || window.location.origin;

  // Generate inbound and post-call webhook URLs
  const inboundUrl = `${apiBaseUrl}/api/webhooks/retell/${orgId}/inbound`;
  const postCallUrl = campaignId
    ? `${apiBaseUrl}/api/webhooks/retell/${orgId}/post-call/${campaignId}`
    : `${apiBaseUrl}/api/webhooks/retell/${orgId}/post-call`;

  return {
    inboundUrl,
    postCallUrl,
  };
};

/**
 * Update agent webhooks in Retell (client-safe)
 */
export const updateAgentWebhooks = async (
  agentId: string,
  orgId: string,
  campaignId?: string,
  options?: {
    baseUrl?: string;
    setInbound?: boolean;
    setPostCall?: boolean;
  },
) => {
  try {
    const {
      baseUrl = window.location.origin,
      setInbound = true,
      setPostCall = true,
    } = options || {};

    // Generate webhook URLs
    const { inboundUrl, postCallUrl } = generateWebhookUrls(
      baseUrl,
      orgId,
      campaignId,
    );

    // Prepare update payload
    const updateData: Record<string, unknown> = {};

    if (setInbound) {
      updateData.inbound_dynamic_variables_webhook_url = inboundUrl;
    }

    if (setPostCall) {
      updateData.webhook_url = postCallUrl;
    }

    // Skip API call if no updates needed
    if (Object.keys(updateData).length === 0) {
      return { success: true, message: "No webhook updates needed" };
    }

    // Call the server-side API route
    const response = await fetch(
      `/api/retell/update-agent?agentId=${agentId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: updateData }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Retell API error: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();
    return {
      success: true,
      ...result,
      webhooks: {
        inbound: setInbound ? inboundUrl : null,
        postCall: setPostCall ? postCallUrl : null,
      },
    };
  } catch (error) {
    console.error("Error updating agent webhooks:", error);
    throw error;
  }
};

/**
 * Update LLM prompt (client-safe)
 */
export const updateLlmPrompt = async (llmId: string, prompt: string) => {
  try {
    const response = await fetch(`/api/retell/update-llm?llmId=${llmId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: { general_prompt: prompt },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Retell API error: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating LLM prompt:", error);
    throw error;
  }
};

/**
 * Update agent voicemail message (client-safe)
 */
export const updateAgentVoicemail = async (
  agentId: string,
  voicemailMessage: string,
) => {
  try {
    const response = await fetch(
      `/api/retell/update-agent?agentId=${agentId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: { voicemail_message: voicemailMessage },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Retell API error: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating agent voicemail:", error);
    throw error;
  }
};

/**
 * Convert Retell post-call analysis data to campaign analysis fields
 */
export const convertPostCallToAnalysisFields = (postCallData?: Array<any>) => {
  if (
    !postCallData ||
    !Array.isArray(postCallData) ||
    postCallData.length === 0
  ) {
    return {
      standardFields: [],
      campaignFields: [],
    };
  }

  // Standard fields that should be in standard section (commonly used across all campaigns)
  const standardFieldNames = [
    "notes",
    "transferred",
    "detected_ai",
    "transfer_reason",
    "patient_reached",
    "patient_questions",
    "callback_requested",
    "callback_date_time",
  ];

  const standardFields = [];
  const campaignFields = [];

  for (const field of postCallData) {
    // Skip fields with missing required properties
    if (!field.name || !field.type) continue;

    const convertedField = {
      key: field.name,
      label: field.name
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
      type:
        field.type === "boolean"
          ? "boolean"
          : field.type === "enum"
            ? "enum"
            : "string",
      options: field.choices || [],
      required: true,
      description: field.description || "",
      isMainKPI: field.name === "appt_confirmed", // Set appointment confirmation as main KPI if present
    };

    // Determine if this is a standard field or campaign-specific field
    if (standardFieldNames.includes(field.name)) {
      standardFields.push(convertedField);
    } else {
      campaignFields.push(convertedField);
    }
  }

  return {
    standardFields,
    campaignFields,
  };
};
