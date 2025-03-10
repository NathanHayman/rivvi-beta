// src/app/(app)/page.tsx
import { DashboardStats, DashboardStatsSimple } from "@/components/analytics";
import { RecentCallsCard } from "@/components/app/call/recent-calls-card";
import { RecentCampaignsCard } from "@/components/app/campaign/recent-campaigns-card";
import { UpcomingRunsCard } from "@/components/app/run/upcoming-runs-card";
import {
  AppBody,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TCall, TCampaign } from "@/types/db";
import { auth } from "@clerk/nextjs/server";
import { formatDistance } from "date-fns";
import {
  BarChart3,
  CheckCircle,
  ChevronRight,
  CircleAlert,
  Clock,
  ListChecks,
  PhoneCall,
  PhoneOutgoing,
  Plus,
} from "lucide-react";
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
    // Try to get simple stats first to ensure we can display something
    return (
      <>
        <DashboardStats orgId={orgId} />
      </>
    );
  } catch (error) {
    // Fallback to simple stats if there's an error
    try {
      const stats = await api.dashboard.getStats();
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
          <DashboardStatsSimple stats={stats} />
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
    const recentCampaigns = await api.campaigns.getAll({ limit: 3 });
    return (
      <RecentCampaignsCard
        campaigns={recentCampaigns.campaigns as TCampaign[]}
      />
    );
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
    const recentCalls = await api.calls.getAll({ limit: 5 });
    return <RecentCallsCard calls={recentCalls.calls as TCall[]} />;
  } catch (error) {
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

async function GetUpcomingRuns() {
  try {
    const upcomingRuns = await api.dashboard.getUpcomingRuns({ limit: 3 });
    return <UpcomingRunsCard runs={upcomingRuns.runs} />;
  } catch (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Runs</CardTitle>
          <CardDescription>Error loading runs</CardDescription>
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

async function GetRecentCalls2() {
  const recentCalls = await api.calls.getAll({ limit: 5 });
  return (
    <CardContent>
      {recentCalls.calls.length > 0 ? (
        <div className="space-y-4">
          {recentCalls.calls.map((call: TCall) => {
            // Determine call status icon
            let StatusIcon = PhoneOutgoing;
            let statusColor = "text-blue-500";

            if (call.status === "completed") {
              StatusIcon = CheckCircle;
              statusColor = "text-green-500";
            } else if (call.status === "failed") {
              StatusIcon = CircleAlert;
              statusColor = "text-red-500";
            } else if (call.status === "in-progress") {
              StatusIcon = Clock;
              statusColor = "text-amber-500";
            }

            return (
              <div
                key={call.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className={statusColor}>
                    <StatusIcon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">
                      {call.patient?.firstName}{" "}
                      {call.patient?.lastName || "Unknown Patient"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistance(new Date(call.createdAt), new Date(), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                </div>
                <Link href={`/calls?callId=${call.id}`}>
                  <Button variant="ghost" size="icon">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground">No calls yet</p>
        </div>
      )}
    </CardContent>
  );
}

async function GetRecentCampaigns2() {
  const recentCampaigns = await api.campaigns.getAll({ limit: 3 });
  return (
    <CardContent>
      {recentCampaigns.campaigns.length > 0 ? (
        <div className="space-y-4">
          {recentCampaigns.campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="space-y-1">
                <div className="font-medium">{campaign.name}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs font-normal">
                    {campaign.direction}
                  </Badge>
                  <span>
                    Created{" "}
                    {formatDistance(new Date(campaign.createdAt), new Date(), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
              <Link href={`/campaigns/${campaign.id}`}>
                <Button variant="ghost" size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <h3 className="text-lg font-medium">No campaigns yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Contact your Rivvi representative to set up your first campaign.
          </p>
          <Button
            className="mt-4"
            size="sm"
            // onClick={() => {
            //   // Open campaign request modal
            // }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Request Campaign
          </Button>
        </div>
      )}
    </CardContent>
  );
}

export default async function DashboardPage() {
  const { orgId } = await auth();

  if (!orgId) {
    redirect("/");
  }

  return (
    <HydrateClient>
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
                    <GetUpcomingRuns />
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

              {/* Campaigns Tab */}
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
                    <GetRecentCampaigns2 />
                  </Suspense>
                </Card>
              </TabsContent>

              {/* Calls Tab */}
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
                    <GetRecentCalls2 />
                  </Suspense>
                </Card>
              </TabsContent>
            </Tabs>
          </AppContent>
        </AppBody>
      </AppPage>
    </HydrateClient>
  );
}
