// src/app/(app)/campaigns/[campaignId]/page.tsx
import { CampaignDetails } from "@/components/app/campaign/campaign-details";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppPage,
} from "@/components/layout/shell";
import { getCampaign } from "@/server/actions/campaigns";
import { Suspense } from "react";

interface PageProps {
  params: {
    campaignId: string;
  };
}

export default async function CampaignPage({ params }: PageProps) {
  const { campaignId } = params;

  // Server-side data fetching
  const campaign = await getCampaign(campaignId);

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          {
            title: campaign?.name || "Campaign",
            href: `/campaigns/${campaignId}`,
          },
        ]}
      />
      <AppBody maxWidth="max-w-screen-xl">
        <AppContent className="space-y-10">
          <Suspense fallback={<div>Loading...</div>}>
            <CampaignDetails campaignId={campaignId} initialData={campaign} />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}

/**
 *   
 * const runData: RunCreateFormProps = {
    campaignId,
    campaignBasePrompt: campaign?.template.basePrompt,
    campaignVoicemailMessage: campaign?.template.voicemailMessage,
    campaignName: campaign?.name,
    campaignDescription: campaign?.template.description,
  };
 */
