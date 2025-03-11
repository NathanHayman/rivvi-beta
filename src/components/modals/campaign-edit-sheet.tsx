"use client";

import { CampaignEditForm } from "@/components/forms/campaign-edit-form";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { TCampaign } from "@/types/db";
import { ZCampaignWithTemplate } from "@/types/zod";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

interface CampaignEditSheetProps {
  campaignData: ZCampaignWithTemplate;
}

export function CampaignEditSheet({ campaignData }: CampaignEditSheetProps) {
  const router = useRouter();
  if (
    !campaignData.campaign?.id ||
    !campaignData.campaign?.name ||
    !campaignData.campaign?.orgId ||
    !campaignData.template?.agentId ||
    !campaignData.template?.basePrompt
  ) {
    console.error("Campaign data is missing required fields", campaignData);
    return null;
  }

  // Convert date strings to Date objects
  const campaign = {
    ...campaignData,
    createdAt: new Date(campaignData.campaign?.createdAt),
    updatedAt: new Date(campaignData.campaign?.updatedAt),
    // Ensure isActive has a default value
    isActive: campaignData.campaign?.isActive ?? true,
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
          campaign={campaign as any}
          onSuccess={() => {
            router.refresh();
          }}
        />
      }
    />
  );
}
