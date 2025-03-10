import { CampaignCreateForm } from "@/components/forms/campaign-create-form";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { CampaignRequestsTable } from "@/components/tables/campaign-requests-table";
import { getAllCampaignRequestsAdmin } from "@/server/actions/admin/campaigns";
import { Plus } from "lucide-react";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Campaign Requests - Rivvi",
  description:
    "Campaign requests for Rivvi's human-like conversational AI for healthcare.",
};

async function CampaignRequestsContent() {
  try {
    const result = await getAllCampaignRequestsAdmin();

    // Validate result structure
    if (!result) {
      return <div>No campaign requests found</div>;
    }

    // Ensure requests property exists and is an array
    if (!result.requests || !Array.isArray(result.requests)) {
      console.error("Invalid result structure:", result);
      return <div>Error: Invalid data structure received from server</div>;
    }

    // Ensure totalCount exists
    const totalCount = result.totalCount || 0;

    // Return the table with the data
    return (
      <CampaignRequestsTable
        initialRequests={result.requests}
        totalCount={totalCount}
      />
    );
  } catch (error) {
    console.error("Error fetching campaign requests:", error);
    return (
      <div>
        Error loading campaign requests:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }
}

export default function AdminCampaignRequestsPage() {
  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Admin", href: "/admin" },
          { title: "Campaign Requests", href: "/admin/campaign-requests" },
        ]}
      />
      <AppBody maxWidth="max-w-screen-xl">
        <AppHeader
          title="Campaign Requests"
          subtitle="Manage and process campaign requests from all organizations"
          buttons={
            <TriggerSheet
              buttonIcon={<Plus />}
              buttonText="Create Campaign"
              form={<CampaignCreateForm />}
              title="Create Campaign"
            />
          }
        />
        <AppContent>
          <Suspense fallback={<div>Loading campaign requests...</div>}>
            <CampaignRequestsContent />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
