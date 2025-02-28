import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";

type PageProps = {
  params: Promise<{ campaignId: string; runId: string }>;
};

export default async function RunPage({ params }: PageProps) {
  const { campaignId, runId } = await params;
  console.log(campaignId, runId);

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          { title: "Campaign Name", href: `/campaigns/${campaignId}` },
          { title: "Runs", href: `/campaigns/${campaignId}/runs` },
          { title: "Run Name", href: `/campaigns/${campaignId}/runs/${runId}` },
        ]}
      />
      <AppBody>
        <AppHeader title="Run Name" />
        <AppContent>TODO: Add run details</AppContent>
      </AppBody>
    </AppPage>
  );
}
