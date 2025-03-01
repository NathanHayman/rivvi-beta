import { Plus } from "lucide-react";
import { EditOrganizationForm } from "../forms/organization-edit-form";
import { TriggerSheet } from "../modals/trigger-sheet";

export function EditOrganizationButton({ orgId }: { orgId: string }) {
  return (
    <TriggerSheet
      buttonIcon={<Plus />}
      buttonText="Create Campaign"
      form={<EditOrganizationForm organizationId={orgId} />}
      title="Create Campaign"
    />
  );
}
