import { CampaignCreateSheet } from "@/components/app/campaign/campaign-create-sheet";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { CampaignsTable } from "@/components/tables/campaigns-table";
import { getAgents } from "@/lib/retell-client";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Campaigns - Rivvi",
  description:
    "Campaigns for Rivvi's human-like conversational AI for healthcare.",
};

type PageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function AdminCampaignsPage({ params }: PageProps) {
  const { orgId } = await params;

  const agents = await getAgents();
  const agentsList = agents.map((agent: any) => ({
    agent_id: agent.agent_id,
    name: agent.agent_name,
  }));

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Organizations", href: "/admin/orgs" },
          { title: orgId, href: `/admin/orgs/${orgId}` },
          { title: "Campaigns", href: `/admin/orgs/${orgId}/campaigns` },
        ]}
      />
      <AppBody maxWidth="max-w-screen-xl">
        <AppHeader
          className=""
          title="Campaigns"
          buttons={<CampaignCreateSheet agents={agentsList} />}
        />
        <AppContent className="">
          <Suspense fallback={<div>Loading...</div>}>
            <CampaignsTable />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
