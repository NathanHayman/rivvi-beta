import { CampaignEditForm } from "@/components/forms/campaign-edit-form";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { isError } from "@/lib/service-result";
import { getCampaignByIdAdmin } from "@/server/actions/admin";
import { notFound } from "next/navigation";
import { Suspense } from "react";

interface PageProps {
  params: Promise<{
    campaignId: string;
  }>;
}

async function EditCampaignPageContent({ campaignId }: { campaignId: string }) {
  try {
    const campaign = await getCampaignByIdAdmin(campaignId);

    if (isError(campaign)) {
      notFound();
    }

    return <CampaignEditForm campaign={campaign.data} />;
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
        Error loading campaign data. Please try again.
      </div>
    );
  }
}

export default async function EditCampaignPage({ params }: PageProps) {
  const { campaignId } = await params;

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/admin/campaigns" },
          {
            title: "Campaign",
            href: `/admin/campaigns/${campaignId}`,
          },
          {
            title: "Edit",
            href: `/admin/campaigns/${campaignId}/edit`,
          },
        ]}
      />
      <AppBody>
        <AppHeader
          title={`Edit Campaign`}
          subtitle="Update campaign settings"
        />
        <AppContent>
          <Suspense fallback={<div>Loading...</div>}>
            <div className="max-w-3xl">
              <EditCampaignPageContent campaignId={campaignId} />
            </div>
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
