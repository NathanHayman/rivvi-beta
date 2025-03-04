import { EditOrganizationForm } from "@/components/forms/organization-edit-form";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { api } from "@/trpc/server";
import { notFound } from "next/navigation";

interface PageProps {
  params: {
    orgId: string;
  };
}

export default async function EditOrganizationPage({ params }: PageProps) {
  // Fetch the organization by ID
  try {
    const organization = await api.organizations.getById({
      id: params.orgId,
    });

    // If the organization doesn't exist, return 404
    if (!organization) {
      notFound();
    }

    return (
      <AppPage>
        <AppBreadcrumbs
          breadcrumbs={[
            { title: "Organizations", href: "/admin/organizations" },
            {
              title: organization.name,
              href: `/admin/organizations/${params.orgId}`,
            },
            {
              title: "Edit",
              href: `/admin/organizations/${params.orgId}/edit`,
            },
          ]}
        />
        <AppBody>
          <AppHeader
            title={`Edit ${organization.name}`}
            subtitle="Update organization settings"
          />
          <AppContent>
            <div className="max-w-2xl">
              <EditOrganizationForm organizationId={params.orgId} />
            </div>
          </AppContent>
        </AppBody>
      </AppPage>
    );
  } catch (error) {
    console.error("Error fetching organization:", error);
    notFound();
  }
}
