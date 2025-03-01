import { Plus } from "lucide-react";
import { CreateOrganizationForm } from "../forms/organization-create-form";
import { TriggerSheet } from "../modals/trigger-sheet";

export function CreateOrganizationButton() {
  return (
    <TriggerSheet
      buttonIcon={<Plus />}
      buttonText="Create Organization"
      form={<CreateOrganizationForm />}
      title="Create Organization"
    />
  );
}
