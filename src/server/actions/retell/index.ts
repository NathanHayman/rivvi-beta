import { retell } from "@/lib/retell-client";
import { convertPostCallToAnalysisFields } from "@/lib/retell/retell-client-safe";

export const retellActions = {
  convertPostCallToAnalysisFields: async (postCallData: any) => {
    return convertPostCallToAnalysisFields(postCallData);
  },
  getRetellAgents: async () => {
    const agents = await retell.agent.list();
    if (!agents) {
      throw new Error("No agents found");
    }
    return agents.map((agent) => ({
      name: agent.agent_name,
      agent_id: agent.agent_id,
    }));
  },
  getRetellAgent: async (agentId: string) => {
    const agent = await retell.agent.retrieve(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    return agent;
  },
  getRetellLlm: async (llmId: string) => {
    const llm = await retell.llm.retrieve(llmId);
    if (!llm) {
      throw new Error(`LLM not found: ${llmId}`);
    }
    return llm;
  },
  getRetellAgentComplete: async (agentId: string) => {
    const agent = await retell.agent.retrieve(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    let llmId = null;
    if (agent.response_engine?.type === "retell-llm") {
      llmId = agent.response_engine.llm_id;
    } else {
      throw new Error("Agent does not use a Retell LLM");
    }
    const llm = await retell.llm.retrieve(llmId);
    if (!llm) {
      throw new Error(`LLM not found: ${llmId}`);
    }
    const combined = {
      agent_id: agent.agent_id,
      agent_name: agent.agent_name,
      llm_id: llm.llm_id,
      general_prompt: llm.general_prompt,
      voicemail_message: agent.voicemail_message,
      post_call_analysis_data: agent.post_call_analysis_data,
      webhook_url: agent.webhook_url,
    };
    return combined;
  },
};
