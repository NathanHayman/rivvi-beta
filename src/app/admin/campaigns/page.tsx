import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { CampaignCreateSheet } from "@/components/modals/campaign-create-sheet";
import { isError } from "@/lib/service-result";
import { getAllCampaignsAdmin } from "@/server/actions/admin";
import { Metadata } from "next";
import { Suspense } from "react";
import { AdminCampaignsTable } from "./_ui/admin-campaigns-table";

export const metadata: Metadata = {
  title: "Campaigns - Rivvi",
  description:
    "Campaigns for Rivvi's human-like conversational AI for healthcare.",
};

type PageProps = {
  params: Promise<{ orgId: string }>;
};

async function CampaignsContent() {
  const campaigns = await getAllCampaignsAdmin();

  if (isError(campaigns)) {
    return <div>Error: {campaigns.error.message}</div>;
  }

  // Map the campaign data to the expected format
  const formattedCampaigns = campaigns.data.map((campaign) => ({
    id: campaign.id || "",
    name: campaign.name || "",
    direction: campaign.direction || "",
    agentId: (campaign as any).config?.agentId || "",
    createdAt: campaign.createdAt ? new Date(campaign.createdAt) : new Date(),
    runCount: (campaign as any).runCount || 0,
    callCount: (campaign as any).callCount || 0,
  }));

  return <AdminCampaignsTable campaigns={formattedCampaigns} />;
}

export default async function AdminCampaignsPage({ params }: PageProps) {
  const { orgId } = await params;

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Organizations", href: "/admin/organizations" },
          { title: orgId, href: `/admin/organizations/${orgId}` },
          {
            title: "Campaigns",
            href: `/admin/organizations/${orgId}/campaigns`,
          },
        ]}
      />
      <AppBody maxWidth="max-w-screen-xl">
        <AppHeader
          className=""
          title="Campaigns"
          buttons={<CampaignCreateSheet />}
        />
        <AppContent className="">
          <Suspense fallback={<div>Loading campaigns...</div>}>
            <CampaignsContent />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
