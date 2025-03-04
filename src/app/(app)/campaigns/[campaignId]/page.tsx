import { CampaignDetails } from "@/components/app/campaign/campaign-details";
import { CreateRunModalButton } from "@/components/app/run/create-run-modal-button";
import { RunCreateForm } from "@/components/forms/run-create-form";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/server";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Campaign Details - Rivvi",
  description:
    "Campaign details for Rivvi's human-like conversational AI for healthcare.",
};

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

export default async function CampaignPage({ params }: PageProps) {
  const { campaignId } = await params;

  // Fetch campaign data from the server
  const campaign = await api.campaigns.getById({ id: campaignId });

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          {
            title: campaign?.name || "Campaign",
            href: `/campaigns/${campaignId}`,
          },
        ]}
      />
      <AppBody maxWidth="max-w-screen-xl">
        <AppHeader
          className=""
          title={campaign?.name || "Campaign"}
          buttons={
            <>
              <Link
                prefetch={false}
                href={`/campaigns/${campaignId}/runs`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                View Runs
              </Link>
              <CreateRunModalButton campaignId={campaignId} />
              <TriggerSheet
                buttonText="Create Campaign"
                form={<RunCreateForm campaignId={campaignId} />}
                title="Create Campaign"
              />
            </>
          }
        />
        <AppContent className="space-y-10">
          <CampaignDetails campaignId={campaignId} initialData={campaign} />
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
