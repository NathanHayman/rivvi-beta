import {
  RunCreateForm,
  RunCreateFormProps,
} from "@/components/forms/create-run-form/form";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { RunsTable } from "@/components/tables/runs-table";
import { getCampaignById } from "@/server/actions/campaigns";
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

  const fullCampaign = await getCampaignById(campaignId);

  const runData: RunCreateFormProps = {
    campaignId,
    campaignBasePrompt: fullCampaign?.template.basePrompt,
    campaignVoicemailMessage: fullCampaign?.template.voicemailMessage,
    campaignName: fullCampaign?.campaign?.name,
    campaignDescription: fullCampaign?.template.description,
  };

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          {
            title: fullCampaign?.campaign?.name || "Campaign",
            href: `/campaigns/${campaignId}`,
          },
          { title: "Runs", href: `/campaigns/${campaignId}/runs` },
        ]}
      />
      <AppBody>
        <AppHeader
          className=""
          title={`${fullCampaign?.campaign?.name || "Campaign"} - Runs`}
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
