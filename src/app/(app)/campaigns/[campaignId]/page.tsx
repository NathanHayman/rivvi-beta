import { CampaignDetails } from "@/components/app/campaign/campaign-details";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppPage,
} from "@/components/layout/shell";
import { getCampaignById } from "@/server/actions/campaigns";
import { Suspense } from "react";

interface PageProps {
  params: Promise<{
    campaignId: string;
  }>;
}

export default async function CampaignPage({ params }: PageProps) {
  const { campaignId } = await params;

  // Server-side data fetching
  const campaignData = await getCampaignById(campaignId);

  // For now, use empty arrays and false as defaults
  const recentRuns = [];
  const isSuperAdmin = false;

  if (!campaignData) {
    return (
      <AppPage>
        <AppBreadcrumbs
          breadcrumbs={[
            { title: "Campaigns", href: "/campaigns" },
            { title: "Not Found", href: `/campaigns/${campaignId}` },
          ]}
        />
        <AppBody maxWidth="max-w-screen-xl">
          <AppContent className="space-y-10">
            <div className="flex h-40 w-full items-center justify-center">
              <div className="text-muted-foreground">Campaign not found</div>
            </div>
          </AppContent>
        </AppBody>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          {
            title: campaignData.campaign?.name || "Campaign",
            href: `/campaigns/${campaignId}`,
          },
        ]}
      />
      <AppBody maxWidth="max-w-screen-xl">
        <AppContent className="space-y-10">
          <Suspense fallback={<div>Loading...</div>}>
            <CampaignDetails
              campaignId={campaignId}
              initialData={campaignData}
              initialRecentRuns={recentRuns}
              isSuperAdmin={isSuperAdmin}
            />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
