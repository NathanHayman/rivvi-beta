import { CreateRunModalButton } from "@/components/app/run/create-run-modal-button";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { RunsTable } from "@/components/tables/runs-table";
import { api } from "@/trpc/server";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Campaign Runs - Rivvi",
  description:
    "Campaign runs for Rivvi's human-like conversational AI for healthcare.",
};

interface PageProps {
  params: Promise<{ campaignId: string }>;
}

export default async function CampaignRunsPage({ params }: PageProps) {
  const { campaignId } = await params;

  const campaign = await api.campaigns.getById({ id: campaignId });

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          {
            title: campaign?.name || "Campaign",
            href: `/campaigns/${campaignId}`,
          },
          { title: "Runs", href: `/campaigns/${campaignId}/runs` },
        ]}
      />
      <AppBody>
        <AppHeader
          className=""
          title={`${campaign?.name || "Campaign"} - Runs`}
          buttons={<CreateRunModalButton campaignId={campaignId} />}
        />
        <AppContent>
          <Suspense fallback={<div>Loading...</div>}>
            <RunsTable campaignId={campaignId} limit={20} />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
