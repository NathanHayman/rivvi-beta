import { CampaignRequestForm } from "../forms/campaign-request-form";
import { TriggerSheet } from "../modals/trigger-sheet";

import { Plus } from "lucide-react";

export function RequestCampaignButton() {
  return (
    <TriggerSheet
      buttonIcon={<Plus />}
      buttonText="Request Campaign"
      form={<CampaignRequestForm />}
      title="Request Campaign"
    />
  );
}
