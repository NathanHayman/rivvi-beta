import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const toNumber = searchParams.get("to");
    const fromNumber = searchParams.get("from");
    const agentId = searchParams.get("agentId");

    // Validate required parameters
    if (!toNumber || !fromNumber || !agentId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Missing required parameters. Include ?to=PHONE&from=PHONE&agentId=AGENT_ID in the URL",
        },
        { status: 400 },
      );
    }

    // Ensure Retell API key is configured
    const apiKey = process.env.RETELL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing RETELL_API_KEY environment variable",
        },
        { status: 500 },
      );
    }

    // Example dynamic variables - ensure all values are strings
    const dynamicVariables = {
      name: "Test User",
      purpose: "API Testing",
      timestamp: new Date().toISOString(), // Already a string
      testValue: "42", // Make sure this is a string
    };

    // Build the request payload
    const payload = {
      to_number: toNumber,
      from_number: fromNumber,
      override_agent_id: agentId,
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
      retell_llm_dynamic_variables: dynamicVariables,
    };

    // Log for debugging
    console.log("[DEBUG] Testing Retell API call with payload:", {
      ...payload,
      to_number: `****${toNumber.slice(-4)}`,
      from_number: `****${fromNumber.slice(-4)}`,
    });

    // Make the direct API request to Retell
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

    // Get response as text first for logging
    const responseText = await response.text();
    console.log(
      `[DEBUG] Retell API raw response (${response.status}):`,
      responseText,
    );

    // Try to parse as JSON if possible
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { text: responseText };
    }

    // Return detailed response for debugging
    return NextResponse.json({
      success: response.ok,
      statusCode: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      requestPayload: {
        ...payload,
        to_number: `****${toNumber.slice(-4)}`, // Redacted for privacy
        from_number: `****${fromNumber.slice(-4)}`, // Redacted for privacy
      },
    });
  } catch (error) {
    console.error("[DEBUG] Error testing Retell API:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to test Retell API",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
