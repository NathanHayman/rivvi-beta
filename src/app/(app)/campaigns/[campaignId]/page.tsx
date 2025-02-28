import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  console.log(campaignId);

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/campaigns" },
          { title: "Campaign", href: `/campaigns/${campaignId}` },
        ]}
      />
      <AppBody maxWidth="max-w-screen-xl">
        <AppHeader
          className=""
          title="Campaign"
          buttons={
            <>
              <Link
                prefetch={false}
                href={`/campaigns/${campaignId}/runs`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                View Runs
              </Link>
              {/* <CreateRunModalButton /> */}
            </>
          }
        />
        <AppContent className="space-y-10">
          <AppContent className="h-full">TODO: Add campaign details</AppContent>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
