import { CreateOrganizationForm } from "@/components/forms/organization-create-form";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { OrganizationsTable } from "@/components/tables/organizations-table";
import { Plus } from "lucide-react";
import { Suspense } from "react";

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
          <Suspense fallback={<div>Loading...</div>}>
            <OrganizationsTable />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
