import { Plus } from "lucide-react";

import { CreateCampaignForm } from "@/components/forms/campaign-create-form";
import { TriggerSheet } from "@/components/modals/trigger-sheet";

interface CampaignCreateSheetProps {
  agents: { agent_id: string; name: string }[];
  className?: string;
}

export function CampaignCreateSheet({
  agents,
  className,
}: CampaignCreateSheetProps) {
  return (
    <TriggerSheet
      buttonText="Create Campaign"
      buttonIcon={<Plus className="mr-2 h-4 w-4" />}
      title="Create New Campaign"
      description="Set up a new campaign for your organization"
      className={className}
      form={<CreateCampaignForm agents={agents} />}
    />
  );
}
