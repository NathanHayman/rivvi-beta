import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { CampaignsTable } from "@/components/tables/campaigns-table";
import { OrganizationCampaignRequestsTable } from "@/components/tables/user-campaign-requests-table";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Calls - Rivvi",
  description: "Calls for Rivvi's human-like conversational AI for healthcare.",
};

export default function Campaigns() {
  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Campaigns", href: "/" }]} />
      <AppBody>
        <AppHeader title="Campaigns" />
        <AppContent className="h-full">
          <Suspense fallback={<div>Loading...</div>}>
            <CampaignsTable />
          </Suspense>
          <Suspense fallback={<div>Loading...</div>}>
            <OrganizationCampaignRequestsTable />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
