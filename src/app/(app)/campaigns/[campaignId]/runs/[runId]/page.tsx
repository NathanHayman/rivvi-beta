// src/app/(app)/campaigns/[campaignId]/runs/[runId]/page.tsx
import { RunDetails } from "@/components/app/run/run-details";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppPage,
} from "@/components/layout/shell";
import { getCampaignById } from "@/server/actions/campaigns";
import { getRun } from "@/server/actions/runs";
import { getRunAnalytics } from "@/server/actions/runs/analytics";
import { Suspense } from "react";

interface PageProps {
  params: Promise<{
    campaignId: string;
    runId: string;
  }>;
}

async function RunDetailsData({
  campaignId,
  runId,
}: {
  campaignId: string;
  runId: string;
}) {
  // Fetch campaign, run and analytics data in parallel
  const [campaign, run, analytics] = await Promise.all([
    getCampaignById(campaignId),
    getRun(runId),
    getRunAnalytics(runId).catch((error) => {
      console.error("Error fetching run analytics:", error);
      return null;
    }),
  ]);

  return (
    <RunDetails
      run={run as any}
      campaign={campaign as any}
      initialAnalytics={analytics}
    />
  );
}

export default async function RunPage({ params }: PageProps) {
  const { campaignId, runId } = await params;

  // Fetch campaign and run data in parallel
  const [campaign, run] = await Promise.all([
    getCampaignById(campaignId),
    getRun(runId),
  ]);

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          {
            title: campaign?.campaign?.name || "Campaign",
            href: `/campaigns/${campaignId}`,
          },
          { title: "Runs", href: `/campaigns/${campaignId}/runs` },
          {
            title: run?.name || "Run",
            href: `/campaigns/${campaignId}/runs/${runId}`,
          },
        ]}
      />
      <AppBody>
        <AppContent>
          <Suspense fallback={<div>Loading...</div>}>
            <RunDetailsData campaignId={campaignId} runId={runId} />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
