import { RequestCampaignButton } from "@/components/buttons/request-campaign-button";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { OrganizationCampaignRequestsTable } from "@/components/tables/organization-campaign-requests-table";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Campaign Requests - Rivvi",
  description:
    "Campaign requests for Rivvi's human-like conversational AI for healthcare.",
};

export default function CampaignRequests() {
  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          { title: "Requests", href: "/campaigns/requests" },
        ]}
      />
      <AppBody>
        <AppHeader
          title="Campaign Requests"
          buttons={<RequestCampaignButton />}
        />
        <AppContent className="h-full">
          <Suspense fallback={<div>Loading...</div>}>
            <OrganizationCampaignRequestsTable />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
