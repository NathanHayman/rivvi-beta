import { Plus } from "lucide-react";

import { CampaignCreateForm } from "@/components/forms/campaign-create-form";
import { TriggerSheet } from "@/components/modals/trigger-sheet";

interface CampaignCreateSheetProps {
  className?: string;
}

export function CampaignCreateSheet({ className }: CampaignCreateSheetProps) {
  return (
    <TriggerSheet
      buttonText="Create Campaign"
      buttonIcon={<Plus className="mr-2 h-4 w-4" />}
      title="Create New Campaign"
      description="Set up a new campaign for your organization"
      size="lg"
      className={className}
      form={<CampaignCreateForm />}
    />
  );
}
