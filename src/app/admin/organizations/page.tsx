import { CreateOrganizationForm } from "@/components/forms/organization-create-form";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { getOrganizations } from "@/server/actions/admin";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { AdminOrganizationsTable } from "./_ui/admin-organizations-table";

async function OrganizationsContent() {
  const result = await getOrganizations({
    limit: 50,
    offset: 0,
    search: "",
  });

  if (!result) {
    return <div>Error</div>;
  }

  return (
    <AdminOrganizationsTable
      organizations={result.organizations}
      totalCount={result.totalCount}
    />
  );
}

export default async function AdminOrganizationsPage() {
  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Organizations", href: "/" }]} />
      <AppBody>
        <AppHeader
          title="Organizations"
          buttons={
            <TriggerSheet
              buttonIcon={<Plus />}
              buttonText="Create Organization"
              form={<CreateOrganizationForm />}
              title="Create Organization"
            />
          }
          className="mb-4"
        />
        <AppContent className="h-full">
          <Suspense fallback={<div>Loading organizations...</div>}>
            <OrganizationsContent />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
