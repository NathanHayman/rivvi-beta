import { TOrg } from "@/types/db";
import { Plus } from "lucide-react";
import { EditOrganizationForm } from "../forms/organization-edit-form";
import { TriggerSheet } from "../modals/trigger-sheet";

export function EditOrganizationButton({ org }: { org: TOrg }) {
  return (
    <TriggerSheet
      buttonIcon={<Plus />}
      buttonText="Edit Organization"
      form={<EditOrganizationForm organization={org} />}
      title="Edit Organization"
    />
  );
}
