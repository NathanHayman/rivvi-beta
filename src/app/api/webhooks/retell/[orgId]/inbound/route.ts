// src/app/api/webhooks/retell/[orgId]/inbound/route.ts
import { handleInboundWebhook } from "@/lib/retell/webhook-handlers";

export const maxDuration = 10; // 10 seconds timeout matching Retell's timeout

// take in an object and return the object with all the keys as strings and values as strings
function convertObjectToKeyValuePairs(
  obj: Record<string, any>,
): Record<string, string> {
  return Object.entries(obj).reduce(
    (acc, [key, value]) => {
      acc[key] = String(value);
      return acc;
    },
    {} as Record<string, string>,
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    // Parse the webhook payload
    const data = (await request.json()) as {
      event: string;
      call_inbound: {
        from_number: string;
        to_number: string;
        agent_id: string;
      };
    };

    console.log(data);

    // Validate the webhook has the necessary data
    if (!data.call_inbound.from_number) {
      // Prepare validation error response with string values for dynamic variables
      const validationErrorObj = {
        error_occurred: true,
        error_message: "Missing caller phone number",
      };

      const validationErrorResponse = {
        status: "error",
        error: "From number not provided",
        call_inbound: {
          dynamic_variables: convertObjectToKeyValuePairs(validationErrorObj),
          metadata: convertObjectToKeyValuePairs({}),
        },
      };

      // Log the validation error response for debugging
      console.log(
        `[API] Validation error response:`,
        JSON.stringify(validationErrorResponse),
      );

      return new Response(JSON.stringify(validationErrorResponse), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    // Log the incoming webhook for debugging
    console.log(
      `[API] Received inbound webhook for org ${orgId}:`,
      JSON.stringify(data),
    );

    // Check for agent_id and llm_id in the payload
    if (!data.call_inbound.agent_id) {
      // If llm_id is provided but agent_id is missing, use llm_id as a fallback
      // This is a temporary solution as Retell might be sending llm_id instead of agent_id
      data.call_inbound.agent_id = "default-inbound-agent";
      console.log(
        `[API] No agent_id provided in webhook, using default value for org ${orgId}`,
      );
    }

    // If agent_id is still missing, provide a default value
    if (!data.call_inbound.agent_id) {
      data.call_inbound.agent_id = "default-inbound-agent";
      console.log(
        `[API] Warning: No agent_id provided in webhook, using default value for org ${orgId}`,
      );
    }

    // Use the webhook handler to process the request
    const result = await handleInboundWebhook(orgId, data.call_inbound);

    // Log the response for debugging
    console.log(
      `[API] Sending inbound webhook response with override_agent_id: ${result.call_inbound.override_agent_id || "none"}`,
    );

    // Prepare the variables as strings first
    const stringVariables = convertObjectToKeyValuePairs(
      result.call_inbound.dynamic_variables,
    );
    const stringMetadata = convertObjectToKeyValuePairs(
      result.call_inbound.metadata,
    );

    // Format the response with URL-encoded query strings and proper call_inbound wrapper
    const response = {
      call_inbound: {
        override_agent_id: result.call_inbound.override_agent_id,
        dynamic_variables: convertObjectToKeyValuePairs(stringVariables),
        metadata: convertObjectToKeyValuePairs(stringMetadata),
      },
    };

    // Log the final response for debugging
    console.log(`[API] Final response structure:`, JSON.stringify(response));

    // Return a properly formatted JSON response
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[API] Error processing inbound webhook:", error);

    // Prepare error response variables
    const errorVariables = {
      error_occurred: true,
      error_message: "Internal server error, please try again later",
    };

    // Format error response with URL-encoded query strings
    const errorResponse = {
      call_inbound: {
        // No override_agent_id in error case
        override_agent_id: null,
        dynamic_variables: convertObjectToKeyValuePairs(errorVariables),
        metadata: convertObjectToKeyValuePairs({}),
      },
    };

    console.log(
      `[API] Error response structure:`,
      JSON.stringify(errorResponse),
    );

    return new Response(JSON.stringify(errorResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
