"use client";

import { CampaignEditForm } from "@/components/forms/campaign-edit-form";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { api } from "@/trpc/react";
import { TCampaign } from "@/types/db";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

interface CampaignEditSheetProps {
  campaignId: string;
}

export function CampaignEditSheet({ campaignId }: CampaignEditSheetProps) {
  const router = useRouter();

  // Fetch campaign data
  const { data: campaignData, isLoading } = api.campaigns.getById.useQuery(
    { id: campaignId },
    { refetchOnWindowFocus: false },
  );

  if (isLoading || !campaignData) {
    return null;
  }

  // Validate that we have all required fields before proceeding
  if (
    !campaignData.id ||
    !campaignData.name ||
    !campaignData.orgId ||
    !campaignData.template.agentId ||
    !campaignData.template.basePrompt
  ) {
    console.error("Campaign data is missing required fields", campaignData);
    return null;
  }

  // Convert date strings to Date objects
  const campaign = {
    ...campaignData,
    createdAt: new Date(campaignData.createdAt),
    updatedAt: new Date(campaignData.updatedAt),
    // Ensure isActive has a default value
    isActive: campaignData.isActive ?? true,
  } as TCampaign;

  return (
    <TriggerSheet
      buttonIcon={<Pencil className="mr-1.5 h-4 w-4" />}
      buttonText="Edit Campaign"
      className="bg-background"
      title={`Edit Campaign: ${campaign.name}`}
      description="Update campaign details and configuration"
      form={
        <CampaignEditForm
          campaign={campaign}
          onSuccess={() => {
            router.refresh();
          }}
        />
      }
    />
  );
}
