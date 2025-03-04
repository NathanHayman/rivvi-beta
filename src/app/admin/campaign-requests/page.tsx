import { CampaignCreateForm } from "@/components/forms/campaign-create-form";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { CampaignRequestsTable } from "@/components/tables/campaign-requests-table";
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
              form={<CampaignCreateForm />}
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
