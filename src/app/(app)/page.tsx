import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppPage,
} from "@/components/layout/shell";

export default async function OverviewPage() {
  //   // Fetch campaign and run data in parallel
  //   const [campaign, run] = await Promise.all([
  //     getCampaign(campaignId),
  //     getRun(runId),
  //   ]);

  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Overview", href: "/" }]} />
      <AppBody>
        <AppContent>
          <div>Overview</div>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
