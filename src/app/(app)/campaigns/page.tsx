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
import { cn } from "@/lib/utils";
import { Metadata } from "next";
import Link from "next/link";
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
            <CampaignsTable />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
