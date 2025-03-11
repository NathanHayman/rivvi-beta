import { RequestCampaignButton } from "@/components/buttons/request-campaign-button";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Metadata } from "next";
import { Suspense } from "react";
import { RequestsTable } from "./_ui/requests-table";

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
            <RequestsTable />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
