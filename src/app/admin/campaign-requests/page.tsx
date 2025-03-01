import { CreateCampaignForm } from "@/components/forms/campaign-create-form";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { CampaignRequestsTable } from "@/components/tables/campaign-requests-table";
import { getAgents } from "@/lib/retell-client";
import { Plus } from "lucide-react";
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
          {
            title: "Campaign Requests",
            href: `/admin/orgs/${orgId}/campaign-requests`,
          },
        ]}
      />
      <AppBody maxWidth="max-w-screen-xl">
        <AppHeader
          className=""
          title="Campaign Requests"
          buttons={
            <TriggerSheet
              buttonIcon={<Plus />}
              buttonText="Create Campaign"
              form={<CreateCampaignForm agents={agentsList} />}
              title="Create Campaign"
            />
          }
        />
        <AppContent className="">
          <Suspense fallback={<div>Loading...</div>}>
            <CampaignRequestsTable />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
