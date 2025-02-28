import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campaigns - Rivvi",
  description:
    "Campaigns for Rivvi's human-like conversational AI for healthcare.",
};

type PageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function AdminCampaignsPage({ params }: PageProps) {
  const { orgId } = await params;

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Organizations", href: "/admin/orgs" },
          { title: orgId, href: `/admin/orgs/${orgId}` },
          { title: "Campaigns", href: `/admin/orgs/${orgId}/campaigns` },
        ]}
      />
      <AppBody maxWidth="max-w-screen-xl">
        <AppHeader
          className=""
          title="Campaigns"
          // buttons={<CreateCampaignSheetButton orgId={orgId} />}
        />
        <AppContent className="">TODO: Add table</AppContent>
      </AppBody>
    </AppPage>
  );
}
