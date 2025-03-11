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
import { CreateRunAction } from "@/components/modals/actions/create-run";
import { getCampaignById } from "@/server/actions/campaigns";
import { getCampaignAnalytics } from "@/server/actions/runs/analytics";
import { getRuns } from "@/server/actions/runs/fetch";
import { Calendar } from "lucide-react";
import { Metadata } from "next";
import { RunsTable } from "./_ui/runs-table";

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

  // Fetch campaign data first
  const campaign = await getCampaignById(campaignId);

  // Fetch runs
  const runs = await getRuns({ campaignId, includeCompleted: true });

  // Try to fetch analytics but handle errors gracefully
  let analytics = null;
  try {
    analytics = await getCampaignAnalytics(campaignId);
  } catch (error) {
    console.error("Error fetching campaign analytics:", error);
    // Create empty analytics structure to avoid UI errors
    analytics = {
      campaign: {
        id: campaignId,
        name: campaign?.campaign?.name || "Campaign",
        direction: campaign?.campaign?.direction || "outbound",
      },
      callMetrics: {
        total: 0,
        completed: 0,
        failed: 0,
        voicemail: 0,
        inProgress: 0,
        pending: 0,
        successRate: 0,
      },
      conversionMetrics: [],
      runMetrics: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  const runData: RunCreateFormProps = {
    campaignId,
    campaignBasePrompt: campaign?.template.basePrompt,
    campaignVoicemailMessage: campaign?.template.voicemailMessage,
    campaignName: campaign?.campaign?.name,
    campaignDescription: campaign?.template.description,
    campaignConfig: campaign?.template.variablesConfig,
  };

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          {
            title: campaign?.campaign?.name || "Campaign",
            href: `/campaigns/${campaignId}`,
          },
          {
            title: "Runs",
            href: `/campaigns/${campaignId}/runs`,
          },
        ]}
      />
      <AppBody>
        <AppHeader
          className=""
          title={`${campaign?.campaign?.name || "Campaign"} - Runs`}
          buttons={
            <CreateRunAction
              type="modal"
              form={<RunCreateForm {...runData} />}
              title="Create Run"
              buttonText="Create Run"
              buttonIcon={<Calendar className="mr-1.5 h-4 w-4" />}
            />
          }
        />
        <AppContent>
          <RunsTable
            runs={runs?.runs || []}
            campaignId={campaignId}
            campaignName={campaign?.campaign?.name || "Campaign"}
            analytics={analytics}
            initialConfig={runData}
          />
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
