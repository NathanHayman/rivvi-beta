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
import { Skeleton } from "@/components/ui/skeleton";
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

async function CampaignsData() {
  console.log("Fetching campaigns data...");
  const campaignsResult = await getAllCampaignsForOrg();

  if (isError(campaignsResult)) {
    console.error("Error fetching campaigns:", campaignsResult.error);
    return <div>Error: {campaignsResult.error.message}</div>;
  }

  // Log the raw data received from the server
  console.log(
    "Raw campaigns data from server:",
    JSON.stringify(
      campaignsResult.data.map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name,
        runCount: campaign.runCount,
        runCountType: typeof campaign.runCount,
        callCount: campaign.callCount,
        callCountType: typeof campaign.callCount,
      })),
      null,
      2,
    ),
  );

  const formattedCampaigns = campaignsResult.data.map((campaign: any) => {
    // Get the runCount and callCount values from the campaign
    const runCount = campaign.runCount ?? 0;
    const callCount = campaign.callCount ?? 0;

    // Log detailed information about the campaign and its count values
    console.log(`Formatting campaign ${campaign.id}:`, {
      name: campaign.name,
      runCount: {
        value: runCount,
        type: typeof runCount,
      },
      callCount: {
        value: callCount,
        type: typeof callCount,
      },
    });

    return {
      id: campaign.id || "",
      name: campaign.name || "",
      direction: campaign.direction || "",
      agentId: campaign.template?.agentId || "",
      createdAt: campaign.createdAt ? new Date(campaign.createdAt) : new Date(),
      runCount: runCount,
      callCount: callCount,
    };
  });

  // Log the final formatted campaigns
  console.log(
    "Formatted campaigns data:",
    JSON.stringify(
      formattedCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        runCount: c.runCount,
        runCountType: typeof c.runCount,
        callCount: c.callCount,
        callCountType: typeof c.callCount,
      })),
      null,
      2,
    ),
  );

  return (
    <CampaignsTable
      initialCampaigns={formattedCampaigns}
      totalCount={formattedCampaigns?.length}
    />
  );
}

export default async function Campaigns() {
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
          <Suspense
            fallback={
              <Skeleton className="h-[25vh] w-full animate-pulse rounded-xl bg-muted" />
            }
          >
            <CampaignsData />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
