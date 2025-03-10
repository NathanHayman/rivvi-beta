import {
  CampaignDetails,
  CampaignDetailsSkeleton,
} from "@/components/app/campaign/campaign-details";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { isError } from "@/lib/service-result";
import { getCampaignByIdAdmin } from "@/server/actions/admin";
import { Edit, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

interface PageProps {
  params: Promise<{
    campaignId: string;
  }>;
}

async function CampaignDetailsContent({ campaignId }: { campaignId: string }) {
  const campaign = await getCampaignByIdAdmin(campaignId);

  if (isError(campaign)) {
    notFound();
  }

  return (
    <CampaignDetails campaignId={campaignId} initialData={campaign.data} />
  );
}

export default async function CampaignDetailsPage({ params }: PageProps) {
  const { campaignId } = await params;

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Campaigns", href: "/admin/campaigns" },
          { title: "Campaign", href: `/admin/campaigns/${campaignId}` },
        ]}
      />
      <AppBody>
        <AppHeader
          title={"Campaign"}
          buttons={
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/campaigns/${campaignId}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  Campaigns
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/admin/campaigns/${campaignId}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            </div>
          }
        />
        <AppContent>
          <Suspense fallback={<CampaignDetailsSkeleton />}>
            <CampaignDetailsContent campaignId={campaignId} />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
