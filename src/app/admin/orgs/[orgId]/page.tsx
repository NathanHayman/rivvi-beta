import { OrganizationDetails } from "@/components/app/organization/organization-details";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/server";
import { Edit, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

interface PageProps {
  params: Promise<{
    orgId: string;
  }>;
}

export default async function OrganizationDetailsPage({ params }: PageProps) {
  const { orgId } = await params;
  // Fetch the organization by ID
  try {
    const organization = await api.organizations.getById({
      id: orgId,
    });

    // If the organization doesn't exist, return 404
    if (!organization) {
      notFound();
    }

    return (
      <AppPage>
        <AppBreadcrumbs
          breadcrumbs={[
            { title: "Organizations", href: "/admin/orgs" },
            { title: organization.name, href: `/admin/orgs/${orgId}` },
          ]}
        />
        <AppBody>
          <AppHeader
            title={organization.name}
            subtitle={
              organization.isSuperAdmin
                ? "Super Admin Organization"
                : "Healthcare Organization"
            }
            buttons={
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/orgs/${orgId}/campaigns`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Campaigns
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/admin/orgs/${orgId}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
              </div>
            }
          />
          <AppContent>
            <Suspense fallback={<div>Loading...</div>}>
              <OrganizationDetails organizationId={orgId} />
            </Suspense>
          </AppContent>
        </AppBody>
      </AppPage>
    );
  } catch (error) {
    console.error("Error fetching organization:", error);
    notFound();
  }
}
