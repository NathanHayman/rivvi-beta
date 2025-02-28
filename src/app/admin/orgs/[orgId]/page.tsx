import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";

type PageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function OrgPage({ params }: PageProps) {
  const { orgId } = await params;
  console.log(orgId);

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Overview", href: "/" },
          { title: "Organizations", href: "/admin/orgs" },
          { title: "Organization Name", href: `/admin/orgs/${orgId}` },
        ]}
      />
      <AppBody>
        <AppHeader
          title={"Organization Name"}
          // buttons={<EditOrgSheetButton org={org} />}
        />
        <AppContent className="flex h-full flex-col gap-4 lg:p-4">
          TODO: Add org details
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
