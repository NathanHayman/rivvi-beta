import { CreateCampaignForm } from "@/components/forms/campaign-create-form";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { OrganizationsTable } from "@/components/tables/organizations-table";
import { getAgents } from "@/lib/retell-client";
import { Plus } from "lucide-react";
import { Suspense } from "react";

// Define the type for Retell agent
interface RetellAgent {
  agent_id: string;
  agent_name?: string;
  [key: string]: any; // Allow for other properties
}

export default async function AdminOrganizationsPage() {
  const agents = await getAgents();
  const agentsList = agents.map((agent: any) => ({
    agent_id: agent.agent_id,
    name: agent.agent_name,
  }));

  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Organizations", href: "/" }]} />
      <AppBody>
        <AppHeader
          title="Organizations"
          // buttons={<CreateOrgSheetButton />}
          buttons={
            <TriggerSheet
              buttonIcon={<Plus />}
              buttonText="Create Campaign"
              form={<CreateCampaignForm agents={agentsList} />}
              title="Create Campaign"
            />
          }
          className="mb-4"
        />
        <AppContent className="h-full">
          <Suspense fallback={<div>Loading...</div>}>
            <OrganizationsTable />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
