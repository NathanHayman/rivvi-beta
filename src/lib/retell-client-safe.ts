import { env } from "@/env";

const retellBaseUrl = "https://api.retellai.com";

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
