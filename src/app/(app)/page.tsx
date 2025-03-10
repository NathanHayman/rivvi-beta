// src/app/(app)/dashboard/page.tsx
import { RecentCallsCard } from "@/components/app/call/recent-calls-card";
import { RecentCampaignsCard } from "@/components/app/campaign/recent-campaigns-card";
import { UpcomingRunsCard } from "@/components/app/run/upcoming-runs-card";
import {
  DashboardStats,
  DashboardStatsSimple,
} from "@/components/dashboard-stats";
import {
  AppBody,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isError } from "@/lib/service-result";
import { getCalls } from "@/server/actions/calls/fetch";
import { getAllCampaignsForOrg } from "@/server/actions/campaigns/fetch";
import { getDashboardStats } from "@/server/actions/dashboard/stats";
import { auth } from "@clerk/nextjs/server";
import { BarChart3, ChevronRight, ListChecks, PhoneCall } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Dashboard - Rivvi",
  description: "Rivvi Dashboard",
};

async function GetDashboardStats({ orgId }: { orgId: string }) {
  try {
    // Use the server action directly
    return (
      <>
        <DashboardStats orgId={orgId} />
      </>
    );
  } catch (error) {
    // Fallback to simple stats if there's an error
    try {
      const stats = await getDashboardStats();
      return (
        <>
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-amber-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">
                  Limited dashboard view
                </h3>
                <p className="mt-2 text-sm text-amber-700">
                  We encountered an issue loading detailed analytics. Showing
                  simplified dashboard instead.
                </p>
              </div>
            </div>
          </div>
          <DashboardStatsSimple stats={stats.counts} />
        </>
      );
    } catch (error) {
      // Last resort fallback
      return (
        <div className="rounded-md border border-red-200 bg-red-50 p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading dashboard
              </h3>
              <p className="mt-2 text-sm text-red-700">
                We're having trouble loading your dashboard. Please try
                refreshing the page or contact support if the issue persists.
              </p>
              <div className="mt-4">
                <Button size="sm" variant="outline" asChild>
                  <Link href=".">Refresh Page</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }
}

async function GetRecentCampaigns() {
  try {
    // Use the server action directly
    const campaignsResult = await getAllCampaignsForOrg();
    if (isError(campaignsResult)) {
      throw new Error(campaignsResult.error.message);
    }

    // Get only the first 3 campaigns
    const recentCampaigns = {
      campaigns: campaignsResult.data.slice(0, 3),
    };

    return <RecentCampaignsCard campaigns={recentCampaigns.campaigns as any} />;
  } catch (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
          <CardDescription>Error loading campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-4">
            <Button size="sm" variant="outline" asChild>
              <Link href=".">Retry</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}

async function GetRecentCalls() {
  try {
    // Use the server action directly with minimal parameters to avoid UUID issues
    const recentCalls = await getCalls({
      limit: 5,
      // Explicitly avoid passing any UUID parameters
    });

    // Check if we have valid data
    if (!recentCalls || !recentCalls.calls) {
      throw new Error("No call data returned");
    }

    // Convert the call data to match the expected type
    const formattedCalls = recentCalls.calls.map((call) => ({
      ...call,
      // Convert string dates to Date objects
      createdAt: new Date(call.createdAt),
    }));

    return <RecentCallsCard calls={formattedCalls} />;
  } catch (error) {
    console.error("Error fetching recent calls:", error);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
          <CardDescription>Error loading calls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-4">
            <Button size="sm" variant="outline" asChild>
              <Link href=".">Retry</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}

export default async function DashboardPage() {
  const { orgId } = await auth();

  if (!orgId) {
    redirect("/");
  }

  return (
    <AppPage>
      <AppBody maxWidth="max-w-screen-2xl">
        <AppHeader title="Dashboard" />
        <AppContent className="space-y-6">
          {/* Dashboard stats */}
          <Suspense
            fallback={
              <div className="h-40 animate-pulse rounded-lg bg-muted"></div>
            }
          >
            <GetDashboardStats orgId={orgId} />
          </Suspense>

          {/* Main content */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
              <TabsTrigger value="calls">Calls</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <Suspense
                  fallback={
                    <div className="h-40 animate-pulse rounded-lg bg-muted"></div>
                  }
                >
                  <GetRecentCampaigns />
                </Suspense>
                <Suspense
                  fallback={
                    <div className="h-40 animate-pulse rounded-lg bg-muted"></div>
                  }
                >
                  <UpcomingRunsCard runs={[]} />
                </Suspense>
                <Suspense
                  fallback={
                    <div className="h-40 animate-pulse rounded-lg bg-muted"></div>
                  }
                >
                  <GetRecentCalls />
                </Suspense>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>
                    Common tasks to get started with
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <Link href="/campaigns">
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <span className="flex items-center">
                        <ListChecks className="mr-2 h-4 w-4" />
                        View Campaigns
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>

                  <Link href="/patients">
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <span className="flex items-center">
                        <PhoneCall className="mr-2 h-4 w-4" />
                        Manage Patients
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>

                  <Link href="/calls">
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <span className="flex items-center">
                        <BarChart3 className="mr-2 h-4 w-4" />
                        View Call Reports
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Campaigns Tab - Implement in separate components */}
            <TabsContent value="campaigns">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">
                    Active Campaigns
                  </CardTitle>
                  <Link href="/campaigns">
                    <Button variant="outline" size="sm">
                      View All
                    </Button>
                  </Link>
                </CardHeader>
                <Suspense fallback={<div>Loading...</div>}>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Loading campaigns...
                    </p>
                  </CardContent>
                </Suspense>
              </Card>
            </TabsContent>

            {/* Calls Tab - Implement in separate components */}
            <TabsContent value="calls">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">
                    Recent Calls
                  </CardTitle>
                  <Link href="/calls">
                    <Button variant="outline" size="sm">
                      View All
                    </Button>
                  </Link>
                </CardHeader>
                <Suspense fallback={<div>Loading...</div>}>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Loading calls...
                    </p>
                  </CardContent>
                </Suspense>
              </Card>
            </TabsContent>
          </Tabs>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
