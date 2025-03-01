"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { CreateCampaignForm } from "@/components/forms/campaign-create-form";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { api } from "@/trpc/react";

interface CampaignCreateSheetProps {
  agents: { agent_id: string; name: string }[];
  className?: string;
}

export function CampaignCreateSheet({
  agents,
  className,
}: CampaignCreateSheetProps) {
  const router = useRouter();
  const { data: organization, isLoading } =
    api.organizations.getCurrent.useQuery();

  if (isLoading) {
    return null;
  }

  if (!organization) {
    return null;
  }

  return (
    <TriggerSheet
      buttonText="Create Campaign"
      buttonIcon={<Plus className="mr-2 h-4 w-4" />}
      title="Create New Campaign"
      description="Set up a new campaign for your organization"
      className={className}
      form={
        <CreateCampaignForm
          agents={agents}
          onSuccess={() => {
            router.refresh();
          }}
        />
      }
    />
  );
}
