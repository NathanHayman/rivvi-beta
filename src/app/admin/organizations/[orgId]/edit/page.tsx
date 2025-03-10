import { EditOrganizationForm } from "@/components/forms/organization-edit-form";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { getOrganization } from "@/server/actions/admin";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{
    orgId: string;
  }>;
}

async function EditOrganizationPageContent({ orgId }: { orgId: string }) {
  try {
    const organization = await getOrganization(orgId);

    if (!organization) {
      notFound();
    }

    return <EditOrganizationForm organization={organization} />;
  } catch (error) {
    console.error("Error fetching organization:", error);
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
        Error loading organization data. Please try again.
      </div>
    );
  }
}

export default async function EditOrganizationPage({ params }: PageProps) {
  const { orgId } = await params;

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Organizations", href: "/admin/organizations" },
          {
            title: "Organization",
            href: `/admin/organizations/${orgId}`,
          },
          {
            title: "Edit",
            href: `/admin/organizations/${orgId}/edit`,
          },
        ]}
      />
      <AppBody>
        <AppHeader
          title={`Edit Organization`}
          subtitle="Update organization settings"
        />
        <AppContent>
          <div className="max-w-2xl">
            <EditOrganizationPageContent orgId={orgId} />
          </div>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
