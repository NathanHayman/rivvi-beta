import { CampaignAnalytics } from "@/components/app/campaign/campaign-analytics";
import { RunCreateFormProps } from "@/components/forms/create-run-form/form";
import { AppBreadcrumbs, AppPage } from "@/components/layout/shell";
import { getCampaignById } from "@/server/actions/campaigns";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Campaign Analytics - Rivvi",
  description:
    "Campaign analytics for Rivvi's human-like conversational AI for healthcare.",
};

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

export default async function CampaignAnalyticsPage({ params }: PageProps) {
  const { campaignId } = await params;

  // Fetch campaign data using server action
  const campaign = await getCampaignById(campaignId);

  if (!campaign) {
    throw new Error(`Campaign with ID ${campaignId} not found`);
  }

  const data: RunCreateFormProps = {
    campaignId,
    campaignBasePrompt: campaign.template?.basePrompt || "",
    campaignVoicemailMessage: campaign.template?.voicemailMessage || "",
    campaignName: campaign.campaign.name,
    campaignDescription: campaign.template?.description || "",
  };

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          {
            title: campaign.campaign.name || "Campaign",
            href: `/campaigns/${campaignId}`,
          },
          {
            title: "Analytics",
            href: `/campaigns/${campaignId}/analytics`,
          },
        ]}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <CampaignAnalytics campaignId={campaignId} />
      </Suspense>
    </AppPage>
  );
}
