import { env } from "@/env";

const retellBaseUrl = "https://api.retellai.com";

// export const getLlmFromAgent = async (agentId: string): Promise<string> => {
//   try {
//     const agentInfo = await getAgentComplete(agentId);
//     return agentInfo.combined.llm_id || "";
//   } catch (error) {
//     console.error("Error getting LLM from agent:", error);
//     throw new TRPCError({
//       code: "INTERNAL_SERVER_ERROR",
//       message: "Failed to get LLM from agent",
//       cause: error,
//     });
//   }
// };

// export const updateRetellAgent = async (
//   agentId: string,
//   updateData: Record<string, unknown>,
// ): Promise<any> => {
//   try {
//     // Fetch the agent first to ensure it exists
//     const agent = await getAgentComplete(agentId);

//     // Call Retell API to update the agent
//     // This is a placeholder - the actual implementation would use the Retell client API
//     const response = await fetch(
//       `https://api.retellhq.com/v1/agents/${agentId}`,
//       {
//         method: "PATCH",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
//         },
//         body: JSON.stringify(updateData),
//       },
//     );

//     if (!response.ok) {
//       throw new Error(`Failed to update agent: ${response.statusText}`);
//     }

//     const updatedAgent = await response.json();
//     return updatedAgent;
//   } catch (error) {
//     console.error("Error updating Retell agent:", error);
//     throw new TRPCError({
//       code: "INTERNAL_SERVER_ERROR",
//       message: "Failed to update Retell agent",
//       cause: error,
//     });
//   }
// };

/**
 * Get all agents from Retell
 */
export const getAgents = async () => {
  try {
    // Use fetch directly to avoid SDK issues with Turbopack
    const response = await fetch(`${retellBaseUrl}/list-agents`, {
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
    const response = await fetch(`${retellBaseUrl}/get-agent/${agentId}`, {
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

    return await response.json();
  } catch (error) {
    console.error("Error getting agent:", error);
    throw error;
  }
};

/**
 * Get the prompt for a Retell agent
 */
export const getLlmFromAgent = async (agentId: string) => {
  try {
    const agent = await getAgent(agentId);
    let llmId = null;
    if (agent.response_engine.type === "retell-llm") {
      llmId = agent.response_engine.llm_id;
    }
    if (!llmId) {
      throw new Error("Agent does not use an LLM");
    }
    const response = await fetch(`${retellBaseUrl}/get-retell-llm/${llmId}`, {
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
    const llm = await response.json();
    console.log("LLM:", llm);
    return llm;
  } catch (error) {
    console.error("Error getting LLM from agent:", error);
    throw error;
  }
};

/**
 * Updates the prompt for a Retell agent
 */
export const updateAgentPrompt = async (agentId: string, prompt: string) => {
  try {
    const llm = await getLlmFromAgent(agentId);
    if (!llm.llm_id) {
      throw new Error("Agent does not use an LLM");
    }
    // const result = await retell.llm.update(llm.llm_id, {
    //   general_prompt: prompt,
    // });
    const response = await fetch(
      `${retellBaseUrl}/update-retell-llm/${llm.llm_id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ general_prompt: prompt }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Retell API error: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
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
      const response = await fetch(`${retellBaseUrl}/update-agent/${agentId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        throw new Error(
          `Retell API error: ${response.status} ${response.statusText}`,
        );
      }
      return await response.json();
    } catch (error) {
      console.error("Error configuring agent webhooks:", error);
      throw error;
    }
  }

  return { message: "No changes to apply" };
};

/**
 * Create a phone call using the Retell API
 */
export async function createPhoneCall({
  toNumber,
  fromNumber,
  agentId,
  variables,
  metadata,
}: {
  toNumber: string;
  fromNumber: string;
  agentId: string;
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
}) {
  try {
    // Ensure Retell API key is configured
    const apiKey = env.RETELL_API_KEY;
    if (!apiKey) {
      console.error("[DEBUG] Missing RETELL_API_KEY environment variable");
      throw new Error("Missing Retell API key");
    }

    // Log the request details (sensitive info redacted)
    console.log(
      `[DEBUG] Creating call to ${maskPhone(toNumber)} from ${maskPhone(fromNumber)}`,
    );
    console.log(`[DEBUG] Using agent: ${agentId}`);

    // Convert all variable values to strings as required by Retell API
    const stringifiedVariables: Record<string, string> = {};
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        // Skip undefined or null values
        if (value === undefined || value === null) return;

        // Handle different value types
        if (typeof value === "object") {
          stringifiedVariables[key] = JSON.stringify(value);
        } else {
          stringifiedVariables[key] = String(value);
        }
      });
    }

    console.log(
      `[DEBUG] Converted variables to strings as required by Retell API`,
    );

    // Build the request payload
    const payload = {
      to_number: toNumber,
      from_number: fromNumber,
      override_agent_id: agentId,
      metadata: metadata || {},
      retell_llm_dynamic_variables: stringifiedVariables, // Use stringified variables
    };

    console.log(
      `[DEBUG] Retell API payload: ${JSON.stringify({
        ...payload,
        to_number: maskPhone(payload.to_number),
        from_number: maskPhone(payload.from_number),
      })}`,
    );

    // Make the API request
    const response = await fetch(
      "https://api.retellai.com/v2/create-phone-call",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      },
    );

    // Check for HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[DEBUG] Retell API error (${response.status}): ${errorText}`,
      );
      throw new Error(`Retell API error: ${response.status} ${errorText}`);
    }

    // Parse the response
    const result = await response.json();
    console.log(
      `[DEBUG] Retell created call successfully: ${JSON.stringify(result)}`,
    );

    // The Retell API v2 returns a response with call_id or id for the call
    // Handle different possible response formats
    const callId = result.call_id || result.id || result.callId;

    if (!callId) {
      console.log(
        `[DEBUG] Retell response missing call_id: ${JSON.stringify(result)}`,
      );

      // If the API response indicates success but doesn't contain a call_id,
      // we'll generate one locally to allow the process to continue
      const generatedCallId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      console.log(`[DEBUG] Generated local call ID: ${generatedCallId}`);

      return {
        ok: true,
        call_id: generatedCallId,
        status: "pending",
        _response: result, // Store the original response for debugging
      };
    }

    return {
      ok: true,
      call_id: callId,
      status: "pending",
    };
  } catch (error) {
    console.error("[DEBUG] Error creating phone call in Retell:", error);
    console.error(
      "[DEBUG] Error stack:",
      error instanceof Error ? error.stack : "Unknown stack",
    );

    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      status: "failed",
      call_id: `error_${Date.now()}`, // Generate an error ID to prevent null references
    };
  }
}

/**
 * Mask a phone number for logging (only show last 4 digits)
 */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "****";
  return `****${phone.slice(-4)}`;
}

/**
 * Get call information from Retell
 */
export const getCallInfo = async (callId: string) => {
  try {
    // const call = await retell.call.retrieve(callId);
    const response = await fetch(`${retellBaseUrl}/get-call/${callId}`, {
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

    return await response.json();
  } catch (error) {
    console.error("Error getting call info:", error);
    throw error;
  }
};

/**
 * Update retell agent
 */
export const updateRetellAgent = async (
  agentId: string,
  updateData: Record<string, unknown>,
) => {
  try {
    // const agent = await retell.agent.update(agentId, updateData);
    const response = await fetch(`${retellBaseUrl}/update-agent/${agentId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      throw new Error(
        `Retell API error: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating retell agent:", error);
    throw error;
  }
};

/**
 * Comprehensive health check for Retell API
 */
export async function healthCheck() {
  try {
    // Check if API key is defined
    const apiKey = process.env.RETELL_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        message: "Retell API key is not configured",
        details: {
          configCheck: "failed",
          suggestion: "Set the RETELL_API_KEY environment variable",
        },
      };
    }

    console.log("[DEBUG] Running Retell API health check");

    // Try to make a request to list agents (should be lightweight)
    const response = await fetch("https://api.retellai.com/v2/list-agents", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[DEBUG] Retell API health check failed (${response.status}): ${errorText}`,
      );
      return {
        success: false,
        message: `Failed to connect to Retell API: ${response.status} ${response.statusText}`,
        details: {
          statusCode: response.status,
          statusText: response.statusText,
          errorResponse: errorText,
          headers: Object.fromEntries(response.headers.entries()),
          apiKeyConfigured: true,
          apiKeyFormat: apiKey.startsWith("key_") ? "valid" : "invalid",
        },
      };
    }

    // Parse the response
    const result = await response.json();

    // Check if we got a proper list of agents
    const agents = result.agents || result.data || [];
    const agentCount = Array.isArray(agents) ? agents.length : 0;

    console.log(
      `[DEBUG] Successfully connected to Retell API. Found ${agentCount} agents.`,
    );

    // Test the API response format
    return {
      success: true,
      message: `Successfully connected to Retell API. Found ${agentCount} agents.`,
      details: {
        statusCode: response.status,
        responseFormat: result.agents ? "expected" : "unexpected",
        agentCount,
        apiVersion: "v2",
        responseStructure: Object.keys(result),
        apiKeyConfigured: true,
        healthCheckTime: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("[DEBUG] Retell API health check error:", error);

    return {
      success: false,
      message: "Error connecting to Retell API",
      details: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        apiKeyConfigured: !!process.env.RETELL_API_KEY,
      },
    };
  }
}
