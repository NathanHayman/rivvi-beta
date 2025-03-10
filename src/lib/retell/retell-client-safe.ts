// src/lib/retell-client-safe.ts

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
 * Get a single agent from Retell (client-safe)
 */
export const getAgent = async (
  agentId: string,
): Promise<RetellAgentComplete> => {
  try {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== "undefined";

    if (isBrowser) {
      // Client-side: Use relative URL
      const response = await fetch(`/api/retell/agent/${agentId}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } else {
      // Server-side: Directly use the Retell API
      const RETELL_BASE_URL = "https://api.retellai.com";
      const { RETELL_API_KEY } = process.env;

      if (!RETELL_API_KEY) {
        throw new Error("RETELL_API_KEY is not defined");
      }

      // Ensure agent ID is properly formatted
      // If it doesn't start with 'agent_', the Retell API will return a 422 error
      const formattedAgentId = agentId.startsWith("agent_")
        ? agentId
        : `agent_${agentId}`;

      console.log("Getting agent from server:", formattedAgentId);

      const response = await fetch(
        `${RETELL_BASE_URL}/get-agent/${formattedAgentId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${RETELL_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Retell API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    }
  } catch (error) {
    console.error("Error fetching agent:", error);
    throw new Error("Failed to fetch agent");
  }
};

/**
 * Get all agents from Retell (client-safe)
 */
export const getAgents = async (): Promise<
  Pick<RetellAgentComplete, "agent_id" | "agent_name">[]
> => {
  try {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== "undefined";

    if (isBrowser) {
      // Client-side: Use relative URL
      const response = await fetch(`/api/retell/agents`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } else {
      // Server-side: Directly use the Retell API
      // No need to import retell-actions since we're making the call directly
      const RETELL_BASE_URL = "https://api.retellai.com";
      const { RETELL_API_KEY } = process.env;

      if (!RETELL_API_KEY) {
        throw new Error("RETELL_API_KEY is not defined");
      }

      const response = await fetch(`${RETELL_BASE_URL}/list-agents`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Retell API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data.map((agent: RetellAgentComplete) => ({
        agent_id: agent.agent_id,
        agent_name: agent.agent_name,
      }));
    }
  } catch (error) {
    console.error("Error fetching agents:", error);
    throw new Error("Failed to fetch agents");
  }
};

/**
 * Get LLM details from Retell (client-safe)
 */
export const getLlm = async (llmId: string): Promise<RetellLlmComplete> => {
  try {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== "undefined";

    if (isBrowser) {
      // Client-side: Use relative URL
      const response = await fetch(`/api/retell/llm/${llmId}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } else {
      // Server-side: Directly use the Retell API
      const RETELL_BASE_URL = "https://api.retellai.com";
      const { RETELL_API_KEY } = process.env;

      if (!RETELL_API_KEY) {
        throw new Error("RETELL_API_KEY is not defined");
      }

      // Ensure LLM ID is properly formatted
      // If it doesn't start with 'llm_', the Retell API will return a 422 error
      const formattedLlmId = llmId.startsWith("llm_") ? llmId : `llm_${llmId}`;

      console.log("Getting LLM from server:", formattedLlmId);

      const response = await fetch(
        `${RETELL_BASE_URL}/get-retell-llm/${formattedLlmId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${RETELL_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Retell API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    }
  } catch (error) {
    console.error("Error fetching LLM:", error);
    throw new Error("Failed to fetch LLM");
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
  const apiBaseUrl = baseUrl;

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
    // Check if we're in a browser environment
    const isBrowser = typeof window !== "undefined";

    if (isBrowser) {
      // Client-side implementation
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
      const response = await fetch(`/api/retell/agent/${agentId}/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          updateData,
          orgId,
          campaignId,
          baseUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
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
    } else {
      // Server-side: Use the server action directly
      const { updateRetellAgentWebhooks } = await import("./retell-actions");

      // Call the server action
      const result = await updateRetellAgentWebhooks(
        agentId,
        orgId,
        campaignId || "",
        options,
      );

      // Generate webhook URLs for the response
      const baseUrl = options?.baseUrl || "";
      const { inboundUrl, postCallUrl } = generateWebhookUrls(
        baseUrl,
        orgId,
        campaignId,
      );

      return {
        success: true,
        ...result,
        webhooks: {
          inbound: options?.setInbound ? inboundUrl : null,
          postCall: options?.setPostCall ? postCallUrl : null,
        },
      };
    }
  } catch (error) {
    console.error("Error updating agent webhooks:", error);
    throw new Error("Failed to update agent webhooks");
  }
};

/**
 * Update LLM prompt (client-safe)
 */
export const updateLlmPrompt = async (llmId: string, prompt: string) => {
  try {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== "undefined";

    if (isBrowser) {
      // Client-side: Use relative URL
      const response = await fetch(`/api/retell/llm/${llmId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } else {
      // Server-side: Directly use the Retell API
      const RETELL_BASE_URL = "https://api.retellai.com";
      const { RETELL_API_KEY } = process.env;

      if (!RETELL_API_KEY) {
        throw new Error("RETELL_API_KEY is not defined");
      }

      const response = await fetch(
        `${RETELL_BASE_URL}/update-retell-llm/${llmId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RETELL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ general_prompt: prompt }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Retell API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    }
  } catch (error) {
    console.error("Error updating LLM prompt:", error);
    throw new Error("Failed to update LLM prompt");
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
    // Check if we're in a browser environment
    const isBrowser = typeof window !== "undefined";

    if (isBrowser) {
      // Client-side: Use relative URL
      const response = await fetch(`/api/retell/agent/${agentId}/voicemail`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voicemailMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } else {
      // Server-side: Directly use the Retell API
      const RETELL_BASE_URL = "https://api.retellai.com";
      const { RETELL_API_KEY } = process.env;

      if (!RETELL_API_KEY) {
        throw new Error("RETELL_API_KEY is not defined");
      }

      // Update the agent voicemail message
      const response = await fetch(
        `${RETELL_BASE_URL}/update-agent/${agentId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RETELL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ voicemail_message: voicemailMessage }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Retell API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    }
  } catch (error) {
    console.error("Error updating agent voicemail:", error);
    throw new Error("Failed to update agent voicemail");
  }
};

/**
 * Get complete agent information including LLM in one call
 */
export const getAgentComplete = async (
  agentId: string,
): Promise<RetellAgentCombined> => {
  try {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== "undefined";

    if (isBrowser) {
      // Client-side: Use relative URL
      const response = await fetch(`/api/retell/agent/${agentId}/complete`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } else {
      // Server-side: Make multiple direct calls to Retell API
      console.log("Getting complete agent info (server):", agentId);

      const agent = await getAgent(agentId);

      let llmId = null;
      if (agent.response_engine?.type === "retell-llm") {
        llmId = agent.response_engine.llm_id;
      } else {
        throw new Error("Agent does not use a Retell LLM");
      }

      const llm = await getLlm(llmId);

      // Combine the data
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

      return { agent, llm, combined };
    }
  } catch (error) {
    console.error("Error fetching complete agent info:", error);
    throw new Error("Failed to fetch complete agent info");
  }
};

export const getLlmFromAgent = async (agentId: string): Promise<string> => {
  try {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== "undefined";

    if (isBrowser) {
      // Client-side: Use relative URL
      const response = await fetch(`/api/retell/agent/${agentId}/llm`);

      if (!response.ok) {
        throw new Error(`Failed to get LLM from agent: ${response.statusText}`);
      }

      const data = await response.json();
      return data.llmId;
    } else {
      // Server-side: Directly use the Retell API
      const RETELL_BASE_URL = "https://api.retellai.com";
      const { RETELL_API_KEY } = process.env;

      if (!RETELL_API_KEY) {
        throw new Error("RETELL_API_KEY is not defined");
      }

      // Step 1: Get the agent details
      const response = await fetch(`${RETELL_BASE_URL}/get-agent/${agentId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      const agent = await response.json();

      // Step 2: Extract the LLM ID
      let llmId = null;
      if (agent.response_engine?.type === "retell-llm") {
        llmId = agent.response_engine.llm_id;
      } else {
        throw new Error("Agent does not use a Retell LLM");
      }

      return llmId;
    }
  } catch (error) {
    console.error("Error getting LLM from agent:", error);
    throw new Error("Failed to get LLM from agent");
  }
};

export const createRetellCall = async (params: {
  toNumber: string;
  fromNumber: string;
  agentId: string;
  variables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) => {
  try {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== "undefined";

    if (isBrowser) {
      // Client-side: Use relative URL
      const response = await fetch(`/api/retell/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toNumber: params.toNumber,
          fromNumber: params.fromNumber,
          agentId: params.agentId,
          variables: params.variables,
          metadata: params.metadata,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create Retell call: ${response.statusText}`);
      }

      return await response.json();
    } else {
      // Server-side: Directly use the Retell API
      const RETELL_BASE_URL = "https://api.retellai.com/v2";
      const { RETELL_API_KEY } = process.env;

      if (!RETELL_API_KEY) {
        throw new Error("RETELL_API_KEY is not defined");
      }

      const response = await fetch(`${RETELL_BASE_URL}/create-phone-call`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to_number: params.toNumber,
          from_number: params.fromNumber,
          override_agent_id: params.agentId,
          retell_llm_dynamic_variables: params.variables,
          metadata: params.metadata,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Retell API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    }
  } catch (error) {
    console.error("Error creating Retell call:", error);
    throw new Error("Failed to create Retell call");
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
