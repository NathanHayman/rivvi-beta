// src/server/actions/retell-actions.ts
"use server";

import { env } from "@/env";
import { db } from "@/server/db";
import { campaigns, campaignTemplates, runs } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Server environment API base URL for Retell
const RETELL_BASE_URL = "https://api.retellai.com";

/**
 * Get a single agent from Retell (server action)
 */
export async function getRetellAgent(agentId: string) {
  try {
    console.log("Getting agent from server:", agentId);

    const response = await fetch(`${RETELL_BASE_URL}/get-agent/${agentId}`, {
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
}

/**
 * Get LLM details from Retell (server action)
 */
export async function getRetellLlm(llmId: string) {
  try {
    console.log("Getting LLM from server:", llmId);

    const response = await fetch(`${RETELL_BASE_URL}/get-retell-llm/${llmId}`, {
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
    console.error("Error getting LLM:", error);
    throw error;
  }
}

/**
 * Get complete agent info (server action)
 */
export async function getRetellAgentComplete(agentId: string) {
  try {
    console.log("Getting complete agent info (server):", agentId);

    // Step 1: Get the agent details
    const agent = await getRetellAgent(agentId);

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

    const llm = await getRetellLlm(llmId);

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
}

/**
 * Update Retell agent webhooks (server action)
 */
export async function updateRetellAgentWebhooks(
  agentId: string,
  orgId: string,
  campaignId: string,
  options: {
    baseUrl?: string;
    setInbound?: boolean;
    setPostCall?: boolean;
  } = {},
) {
  try {
    const {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://api.rivvi.ai",
      setInbound = true,
      setPostCall = true,
    } = options;

    // Generate webhook URLs
    const inboundUrl = `${baseUrl}/api/webhooks/retell/${orgId}/inbound`;
    const postCallUrl = `${baseUrl}/api/webhooks/retell/${orgId}/post-call/${campaignId}`;

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

    // Update the agent
    const response = await fetch(`${RETELL_BASE_URL}/update-agent/${agentId}`, {
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

    // Update the campaign config with webhook URLs
    await updateCampaignWithWebhooks(campaignId, { inboundUrl, postCallUrl });

    return {
      success: true,
      webhooks: {
        inbound: setInbound ? inboundUrl : null,
        postCall: setPostCall ? postCallUrl : null,
      },
    };
  } catch (error) {
    console.error("Error updating agent webhooks:", error);
    throw error;
  }
}

/**
 * Update campaign config with webhook URLs (server action)
 */
export async function updateCampaignWithWebhooks(
  campaignId: string,
  webhooks: {
    inboundUrl?: string;
    postCallUrl?: string;
  },
) {
  try {
    // Get current campaign and its template
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Get template details
    const [template] = await db
      .select()
      .from(campaignTemplates)
      .where(eq(campaignTemplates.id, campaign.templateId));

    if (!template) {
      throw new Error("Campaign template not found");
    }

    // Update the template with webhook URLs using SQL directly
    if (webhooks.inboundUrl || webhooks.postCallUrl) {
      // Build the SQL dynamically based on what fields need updating
      const parts = [];
      if (webhooks.inboundUrl) {
        parts.push(sql`inbound_webhook_url = ${webhooks.inboundUrl}`);
      }
      if (webhooks.postCallUrl) {
        parts.push(sql`post_call_webhook_url = ${webhooks.postCallUrl}`);
      }

      if (parts.length > 0) {
        // Combine all parts with commas and execute
        await db.execute(sql`
          UPDATE rivvi_campaign_template 
          SET ${sql.join(parts, sql`, `)}
          WHERE id = ${campaign.templateId}
        `);
      }
    }

    // Revalidate the campaign page to reflect changes
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath(`/admin/campaigns/${campaignId}`);

    return {
      success: true,
      webhooks: {
        inbound: webhooks.inboundUrl || template.inboundWebhookUrl,
        postCall: webhooks.postCallUrl || template.postCallWebhookUrl,
      },
    };
  } catch (error) {
    console.error("Error updating campaign webhooks:", error);
    throw error;
  }
}

/**
 * Update campaign with voicemail message (server action)
 */
export async function updateCampaignVoicemail(
  campaignId: string,
  voicemailMessage: string,
  updateRetell = true,
) {
  try {
    // Get current campaign and its template
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Get template details
    const [template] = await db
      .select()
      .from(campaignTemplates)
      .where(eq(campaignTemplates.id, campaign.templateId));

    if (!template) {
      throw new Error("Campaign template not found");
    }

    // Update the template with voicemail message using SQL directly
    await db.execute(sql`
      UPDATE rivvi_campaign_template 
      SET voicemail_message = ${voicemailMessage}
      WHERE id = ${campaign.templateId}
    `);

    // Update Retell if requested
    if (updateRetell) {
      // Update the agent voicemail message
      const response = await fetch(
        `${RETELL_BASE_URL}/update-agent/${template.agentId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RETELL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ voicemail_message: voicemailMessage }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Retell API error: ${response.status} ${response.statusText}`,
        );
      }
    }

    // Revalidate the campaign page
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath(`/admin/campaigns/${campaignId}`);

    return { success: true, voicemailMessage };
  } catch (error) {
    console.error("Error updating campaign voicemail:", error);
    throw error;
  }
}

/**
 * Update prompt with proper history tracking (server action)
 */
export async function updatePromptWithHistory(params: {
  campaignId: string;
  runId?: string;
  userId?: string;
  naturalLanguageInput?: string;
  generatedPrompt: string;
  updateRetell?: boolean;
}) {
  const {
    campaignId,
    runId,
    userId,
    naturalLanguageInput,
    generatedPrompt,
    updateRetell = true,
  } = params;

  try {
    // Get the campaign and its template to find the base prompt and LLM ID
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Get template details
    const [template] = await db
      .select()
      .from(campaignTemplates)
      .where(eq(campaignTemplates.id, campaign.templateId));

    if (!template) {
      throw new Error("Campaign template not found");
    }

    // If we have a run ID, update the run's custom prompt
    if (runId) {
      const [run] = await db.select().from(runs).where(eq(runs.id, runId));

      if (run) {
        // Preserve existing metadata structure
        const updatedMetadata = {
          ...run.metadata,
          run: {
            ...(run.metadata?.run || {}),
            naturalLanguageInput: naturalLanguageInput || "",
            promptUpdatedAt: new Date().toISOString(),
          },
        };

        await db
          .update(runs)
          .set({
            customPrompt: generatedPrompt,
            metadata: updatedMetadata,
          })
          .where(eq(runs.id, runId));

        // Revalidate the run page
        revalidatePath(`/campaigns/${campaignId}/runs/${runId}`);
      }
    }

    // Record the prompt change in the agentVariations table using SQL directly
    if (naturalLanguageInput) {
      let sqlQuery;
      if (userId) {
        sqlQuery = sql`
          INSERT INTO rivvi_agent_variation 
          (id, campaign_id, user_input, original_base_prompt, customized_prompt, user_id, created_at) 
          VALUES 
          (gen_random_uuid(), ${campaignId}, ${naturalLanguageInput}, ${template.basePrompt}, ${generatedPrompt}, ${userId}, CURRENT_TIMESTAMP)
        `;
      } else {
        sqlQuery = sql`
          INSERT INTO rivvi_agent_variation 
          (id, campaign_id, user_input, original_base_prompt, customized_prompt, created_at) 
          VALUES 
          (gen_random_uuid(), ${campaignId}, ${naturalLanguageInput}, ${template.basePrompt}, ${generatedPrompt}, CURRENT_TIMESTAMP)
        `;
      }

      await db.execute(sqlQuery);
    }

    // Update the Retell LLM prompt if requested
    if (updateRetell && template.llmId) {
      const response = await fetch(
        `${RETELL_BASE_URL}/update-retell-llm/${template.llmId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RETELL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ general_prompt: generatedPrompt }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Retell API error: ${response.status} ${response.statusText}`,
        );
      }
    }

    return { success: true, prompt: generatedPrompt };
  } catch (error) {
    console.error("Error updating prompt:", error);
    throw error;
  }
}
