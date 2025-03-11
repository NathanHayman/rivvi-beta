import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { getOrganization } from "@/server/actions/admin";
import { Edit, Phone } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  OrganizationDetails,
  OrganizationDetailsSkeleton,
} from "./_ui/organization-details";

export const metadata: Metadata = {
  title: "Organization Details - Rivvi",
  description:
    "Organization details for Rivvi's human-like conversational AI for healthcare.",
};

interface PageProps {
  params: Promise<{
    orgId: string;
  }>;
}

async function OrganizationDetailsContent({ orgId }: { orgId: string }) {
  const organization = await getOrganization(orgId);

  if (!organization) {
    notFound();
  }

  return <OrganizationDetails organization={organization} />;
}

export default async function OrganizationDetailsPage({ params }: PageProps) {
  const { orgId } = await params;
  // Fetch the organization by ID
  try {
    const organization = await getOrganization(orgId);

    // If the organization doesn't exist, return 404
    if (!organization) {
      notFound();
    }

    return (
      <AppPage>
        <AppBreadcrumbs
          breadcrumbs={[
            { title: "Organizations", href: "/admin/organizations" },
            { title: organization.name, href: `/admin/organizations/${orgId}` },
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
                  <Link href={`/admin/organizations/${orgId}/campaigns`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Campaigns
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/admin/organizations/${orgId}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
              </div>
            }
          />
          <AppContent>
            <Suspense fallback={<OrganizationDetailsSkeleton />}>
              <OrganizationDetailsContent orgId={orgId} />
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
