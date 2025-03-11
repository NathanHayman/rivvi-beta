import { RunCreateFormProps } from "@/components/forms/create-run-form/form";
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
import {
  AdminCampaignDetails,
  AdminCampaignDetailsSkeleton,
} from "./_ui/admin-campaign-details";

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

  const config: RunCreateFormProps = {
    campaignId,
    campaignBasePrompt: campaign.data.template.basePrompt,
    campaignVoicemailMessage: campaign.data.template.voicemailMessage,
    campaignName: campaign.data.campaign?.name,
    campaignDescription: campaign.data.template.description,
    campaignConfig: campaign.data.template.variablesConfig,
  };

  return (
    <AdminCampaignDetails
      campaignId={campaignId}
      initialData={campaign.data}
      initialConfig={config}
    />
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
          <Suspense fallback={<AdminCampaignDetailsSkeleton />}>
            <CampaignDetailsContent campaignId={campaignId} />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
