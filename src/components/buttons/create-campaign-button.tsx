import { getAgents } from "@/lib/retell-client";
import { Plus } from "lucide-react";
import { CreateCampaignForm } from "../forms/campaign-create-form";
import { TriggerSheet } from "../modals/trigger-sheet";

export async function CreateCampaignButton() {
  const agents = await getAgents();
  const agentsList = agents.map((agent: any) => ({
    agent_id: agent.agent_id,
    name: agent.agent_name,
  }));

  return (
    <TriggerSheet
      buttonIcon={<Plus />}
      buttonText="Create Campaign"
      form={<CreateCampaignForm agents={agentsList} />}
      title="Create Campaign"
    />
  );
}
