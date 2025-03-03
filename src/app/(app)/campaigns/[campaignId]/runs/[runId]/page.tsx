import { RunDetails } from "@/components/app/run/run-details";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { api } from "@/trpc/server";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Run Details - Rivvi",
  description:
    "Run details for Rivvi's human-like conversational AI for healthcare.",
};

type PageProps = {
  params: Promise<{ campaignId: string; runId: string }>;
};

export default async function RunPage({ params }: PageProps) {
  const { campaignId, runId } = await params;

  // Fetch campaign and run data from the server
  const campaign = await api.campaigns.getById({ id: campaignId });
  const run = await api.runs.getById({ id: runId });

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
          {
            title: run?.name || "Run",
            href: `/campaigns/${campaignId}/runs/${runId}`,
          },
        ]}
      />
      <AppBody>
        <AppHeader
          title={run?.name || "Run"}
          subtitle={`Status: ${run?.status || "Unknown"}`}
        />
        <AppContent>
          {run && campaign && (
            <RunDetails
              run={{
                id: run.id,
                name: run.name,
                status: run.status,
                customPrompt: run.customPrompt,
                scheduledAt: run.scheduledAt || undefined,
                metadata: run.metadata || {},
                createdAt: run.createdAt,
                updatedAt: run.updatedAt || run.createdAt,
              }}
              campaign={{
                id: campaign.id,
                name: campaign.name,
                direction: campaign.direction,
              }}
            />
          )}
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
