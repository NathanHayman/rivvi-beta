import { CampaignCreateSheet } from "@/components/app/campaign/campaign-create-sheet";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { AdminCampaignsTable } from "@/components/tables/admin-campaigns-table";
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
          <Suspense fallback={<div>Loading...</div>}>
            <AdminCampaignsTable />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
