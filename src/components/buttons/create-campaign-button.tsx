"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { getAgents } from "@/lib/retell-client-safe";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { CreateCampaignForm } from "../forms/campaign-create-form";
import { TriggerSheet } from "../modals/trigger-sheet";

export function CreateCampaignButton() {
  const [agents, setAgents] = useState<
    Array<{ agent_id: string; name: string; llm_id?: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true);
        const agentsData = await getAgents();
        const agentsList = agentsData.map((agent: any) => ({
          agent_id: agent.agent_id,
          name: agent.agent_name,
          llm_id: agent.llm_id || agent.response_engine?.llm_id || null,
        }));
        setAgents(agentsList);
      } catch (error) {
        console.error("Error fetching agents:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  return (
    <TriggerSheet
      buttonIcon={<Plus />}
      buttonText="Create Campaign"
      form={
        loading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <CreateCampaignForm agents={agents} />
        )
      }
      title="Create Campaign"
    />
  );
}
