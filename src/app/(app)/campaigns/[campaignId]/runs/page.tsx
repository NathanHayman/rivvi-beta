import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Metadata } from "next";

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
  console.log(campaignId);

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          { title: "Campaign Name", href: `/campaigns/${campaignId}` },
          { title: "Runs", href: `/campaigns/${campaignId}/runs` },
        ]}
      />
      <AppBody>
        <AppHeader
          className=""
          title={`Campaign Name - Runs`}
          // buttons={<CreateRunModalButton />}
        />
        <AppContent>TODO: Add runs table</AppContent>
      </AppBody>
    </AppPage>
  );
}
