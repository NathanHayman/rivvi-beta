import { CampaignAnalytics } from "@/components/app/campaign/campaign-analytics";
import { RunCreateFormProps } from "@/components/forms/run-create-form";
import { AppBreadcrumbs, AppPage } from "@/components/layout/shell";
import { api } from "@/trpc/server";
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

  // Fetch campaign data from the server
  const campaign = await api.campaigns.getById({ id: campaignId });

  const data: RunCreateFormProps = {
    campaignId,
    campaignBasePrompt: campaign?.template.basePrompt,
    campaignVoicemailMessage: campaign?.template.voicemailMessage,
    campaignName: campaign?.name,
    campaignDescription: campaign?.template.description,
  };

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          {
            title: campaign?.name || "Campaign",
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
