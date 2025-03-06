import {
  RunCreateForm,
  RunCreateFormProps,
} from "@/components/forms/run-create-form";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { RunsTable } from "@/components/tables/runs-table";
import { api } from "@/trpc/server";
import { Calendar } from "lucide-react";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Campaign Runs - Rivvi",
  description:
    "Campaign runs for Rivvi's human-like conversational AI for healthcare.",
};

interface PageProps {
  params: Promise<{ campaignId: string }>;
}

export default async function CampaignRunsPage({ params }: PageProps) {
  const { campaignId } = await params;

  const campaign = await api.campaigns.getById({ id: campaignId });

  const runData: RunCreateFormProps = {
    campaignId,
    campaignBasePrompt: campaign?.template.basePrompt,
    campaignVoicemailMessage: campaign?.template.voicemailMessage,
    campaignName: campaign?.name,
    campaignDescription: campaign?.template.description,
  };

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          {
            title: campaign?.name || "Campaign",
            href: `/campaigns/${campaignId}`,
          },
          { title: "Runs", href: `/campaigns/${campaignId}/runs` },
        ]}
      />
      <AppBody>
        <AppHeader
          className=""
          title={`${campaign?.name || "Campaign"} - Runs`}
          buttons={
            <TriggerSheet
              buttonText="Create Run"
              form={<RunCreateForm {...runData} />}
              buttonIcon={<Calendar className="mr-1.5 h-4 w-4" />}
              title="Create Run"
            />
          }
        />
        <AppContent>
          <Suspense fallback={<div>Loading...</div>}>
            <RunsTable campaignId={campaignId} limit={20} />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
