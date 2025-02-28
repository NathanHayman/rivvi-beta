import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";

export default async function AdminOrganizationsPage() {
  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Organizations", href: "/" }]} />
      <AppBody>
        <AppHeader
          title="Organizations"
          // buttons={<CreateOrgSheetButton />}
          className="mb-4"
        />
        <AppContent className="h-full">TODO: Add table</AppContent>
      </AppBody>
    </AppPage>
  );
}
