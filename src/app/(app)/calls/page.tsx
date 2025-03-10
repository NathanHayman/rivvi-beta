// src/app/(app)/calls/page.tsx
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { getCalls } from "@/server/actions/calls/fetch";
import { Metadata } from "next";
import { Suspense } from "react";
import { CallDetailsSheet } from "./_components/call-details-sheet";
import { CallsTable } from "./_components/calls-table";

export const metadata: Metadata = {
  title: "Calls - Rivvi",
  description: "View and manage all calls in the Rivvi platform.",
};

// This server component fetches the initial data
async function InitialCallsData({
  callIdToView,
  searchParams,
}: {
  callIdToView?: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  try {
    // Await searchParams before accessing its properties
    const params = await searchParams;

    // Extract filter parameters
    const limit = params?.limit ? parseInt(params.limit as string, 10) : 20;
    const offset = params?.offset ? parseInt(params.offset as string, 10) : 0;
    const status = params?.status as string | undefined;
    const direction = params?.direction as string | undefined;
    const search = params?.search as string | undefined;
    const campaignId = params?.campaignId as string | undefined;

    // Fetch the first batch of calls using server action with filters
    const initialData = await getCalls({
      limit,
      offset,
      status,
      direction,
      search,
      campaignId,
    });

    return <CallsTable initialData={initialData} callIdToView={callIdToView} />;
  } catch (error) {
    console.error("Error fetching initial calls data:", error);
    // If there's an error, pass empty data to the client component
    // which will handle the error state
    return (
      <CallsTable
        initialData={{
          calls: [],
          totalCount: 0,
          hasMore: false,
        }}
        callIdToView={callIdToView}
      />
    );
  }
}

export default async function Calls({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Await searchParams before accessing its properties
  const params = await searchParams;

  // Get the callId from the search params if it exists
  const callIdToView = params.callId as string | undefined;

  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Calls", href: "/calls" }]} />
      <AppBody>
        <AppHeader
          title="Calls"
          subtitle="View and manage all inbound and outbound calls"
        />
        <AppContent className="h-full space-y-4">
          <Suspense fallback={<div>Loading calls...</div>}>
            <InitialCallsData
              callIdToView={callIdToView}
              searchParams={params}
            />
          </Suspense>
          <CallDetailsSheet />
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
