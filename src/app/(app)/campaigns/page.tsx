import { RequestCampaignButton } from "@/components/buttons/request-campaign-button";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { CampaignsTable } from "@/components/tables/campaigns-table";
import { buttonVariants } from "@/components/ui/button";
import { isError } from "@/lib/service-result";
import { cn } from "@/lib/utils";
import { getAllCampaignsForOrg } from "@/server/actions/campaigns";
import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Calls - Rivvi",
  description: "Calls for Rivvi's human-like conversational AI for healthcare.",
};

export default async function Campaigns() {
  const campaignsResult = await getAllCampaignsForOrg();

  if (isError(campaignsResult)) {
    return <div>Error: {campaignsResult.error.message}</div>;
  }

  const formattedCampaigns = campaignsResult.data.map((campaign: any) => ({
    id: campaign.id || "",
    name: campaign.name || "",
    direction: campaign.direction || "",
    agentId: campaign.template?.agentId || "",
    createdAt: campaign.createdAt ? new Date(campaign.createdAt) : new Date(),
  }));

  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Campaigns", href: "/" }]} />
      <AppBody>
        <AppHeader
          title="Campaigns"
          buttons={[
            <Link
              href="/campaigns/requests"
              key="view-my-requests"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              View My Requests
            </Link>,
            <RequestCampaignButton key="request-campaign-button" />,
          ]}
        />
        <AppContent className="h-full">
          <Suspense fallback={<div>Loading...</div>}>
            <CampaignsTable
              initialCampaigns={formattedCampaigns}
              totalCount={formattedCampaigns.length}
            />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
