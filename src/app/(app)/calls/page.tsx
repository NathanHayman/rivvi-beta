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
  title: "Call Center | Rivvi",
  description: "Manage and analyze your inbound and outbound calls.",
};

function CallsLoading() {
  return (
    <div className="flex h-[400px] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary"></div>
        <p className="font-medium text-muted-foreground">Loading calls...</p>
      </div>
    </div>
  );
}

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
    const limit = params?.limit ? parseInt(params.limit as string, 10) : 10; // Changed default to 10
    const offset = params?.offset ? parseInt(params.offset as string, 10) : 0;
    const status = params?.status as string | undefined;
    const direction = params?.direction as string | undefined;
    const search = params?.search as string | undefined;
    const campaignId = params?.campaignId as string | undefined;
    const dateRange = params?.dateRange as string | undefined;

    // Handle date range filter
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (dateRange) {
      const now = new Date();

      switch (dateRange) {
        case "today":
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
          startDate.setHours(0, 0, 0, 0);
          break;
        case "month":
          startDate = new Date(now);
          startDate.setDate(1); // Start of month
          startDate.setHours(0, 0, 0, 0);
          break;
      }
    }

    // Fetch the first batch of calls using server action with filters
    const initialData = await getCalls({
      limit,
      offset,
      status,
      direction,
      search,
      campaignId,
      startDate,
      endDate,
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
          title="Call Center"
          subtitle="Manage and monitor all incoming and outgoing patient communications"
        />
        <AppContent className="h-full space-y-4">
          <Suspense fallback={<CallsLoading />}>
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
