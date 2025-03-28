// src/app/(app)/calls/page.tsx
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { getCalls, GetCallsParams } from "@/server/actions/calls/fetch";
import { Metadata } from "next";
import { Suspense } from "react";
import { CallDetailsSheet } from "./_ui/call-details-sheet";
import { CallsTable } from "./_ui/calls-table";

export const metadata: Metadata = {
  title: "Call Center | Rivvi",
  description: "Manage and analyze your inbound and outbound calls.",
};

// Loading component
function CallsLoading() {
  return (
    <div className="flex h-[500px] w-full items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-muted-foreground">Loading calls...</p>
      </div>
    </div>
  );
}

// This server component safely fetches the initial data
async function InitialCallsData({
  callIdToView,
  searchParams,
}: {
  callIdToView?: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  try {
    // Parse filter parameters with proper validation
    const limit = searchParams?.limit
      ? parseInt(
          Array.isArray(searchParams.limit)
            ? searchParams.limit[0]
            : searchParams.limit,
          10,
        ) || 10
      : 10;

    const offset = searchParams?.offset
      ? parseInt(
          Array.isArray(searchParams.offset)
            ? searchParams.offset[0]
            : searchParams.offset,
          10,
        ) || 0
      : 0;

    // Safely extract string parameters
    const safeGetParam = (key: string): string | undefined => {
      const value = searchParams?.[key];
      if (!value) return undefined;
      return Array.isArray(value) ? value[0] : value;
    };

    // Extract filter parameters
    const status = safeGetParam("status");
    const direction = safeGetParam("direction");
    const search = safeGetParam("search");
    const campaignId = safeGetParam("campaignId");
    const dateRange = safeGetParam("dateRange");

    // Handle date range filter
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (dateRange) {
      const now = new Date();

      switch (dateRange) {
        case "today":
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);
          startDate = todayStart.toISOString();
          break;
        case "yesterday":
          const yesterdayStart = new Date(now);
          yesterdayStart.setDate(now.getDate() - 1);
          yesterdayStart.setHours(0, 0, 0, 0);
          startDate = yesterdayStart.toISOString();

          const yesterdayEnd = new Date(now);
          yesterdayEnd.setDate(now.getDate() - 1);
          yesterdayEnd.setHours(23, 59, 59, 999);
          endDate = yesterdayEnd.toISOString();
          break;
        case "week":
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
          weekStart.setHours(0, 0, 0, 0);
          startDate = weekStart.toISOString();
          break;
        case "month":
          const monthStart = new Date(now);
          monthStart.setDate(1); // Start of month
          monthStart.setHours(0, 0, 0, 0);
          startDate = monthStart.toISOString();
          break;
      }
    }

    // Build params object only with defined values
    const callParams: GetCallsParams = {
      limit,
      offset,
    };

    if (status && status !== "all") callParams.status = status;
    if (direction && direction !== "all") callParams.direction = direction;
    if (search) callParams.search = search;
    if (campaignId && campaignId !== "all") callParams.campaignId = campaignId;
    if (startDate) callParams.startDate = startDate;
    if (endDate) callParams.endDate = endDate;

    // Fetch the first batch of calls using server action with filters
    const initialData = await getCalls(callParams);

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

// Main page component
export default async function Calls({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Extract callId for the detail view
  const callIdParam = params?.callId;
  const callIdToView =
    typeof callIdParam === "string"
      ? callIdParam
      : Array.isArray(callIdParam)
        ? callIdParam[0]
        : undefined;

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
