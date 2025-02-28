// src/app/(app)/page.tsx
import { RecentCallsCard } from "@/components/app/call/recent-calls-card";
import { RecentCampaignsCard } from "@/components/app/campaign/recent-campaigns-card";
import { UpcomingRunsCard } from "@/components/app/run/upcoming-runs-card";
import { DashboardStats } from "@/components/dashboard-stats";
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
import { api, HydrateClient } from "@/trpc/server";
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
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Dashboard - Rivvi",
  description: "Rivvi Dashboard",
};

async function GetRecentCampaigns() {
  const recentCampaigns = await api.campaigns.getAll({ limit: 3 });
  return <RecentCampaignsCard campaigns={recentCampaigns.campaigns} />;
}

async function GetRecentCalls() {
  const recentCalls = await api.calls.getAll({ limit: 5 });
  return <RecentCallsCard calls={recentCalls.calls} />;
}

async function GetUpcomingRuns() {
  const upcomingRuns = await api.dashboard.getUpcomingRuns({ limit: 3 });
  return <UpcomingRunsCard runs={upcomingRuns.runs} />;
}

async function GetDashboardStats() {
  const stats = await api.dashboard.getStats();
  return <DashboardStats stats={stats} />;
}

async function GetRecentCalls2() {
  const recentCalls = await api.calls.getAll({ limit: 5 });
  return (
    <CardContent>
      {recentCalls.calls.length > 0 ? (
        <div className="space-y-4">
          {recentCalls.calls.map((call) => {
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
                <Link href={`/calls/${call.id}`}>
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
                    {campaign.type}
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
  return (
    <HydrateClient>
      <AppPage>
        <AppBody maxWidth="max-w-screen-2xl">
          <AppHeader title="Dashboard" />
          <AppContent className="space-y-6">
            {/* Dashboard stats */}
            <Suspense fallback={<div>Loading...</div>}>
              <GetDashboardStats />
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
                  <Suspense fallback={<div>Loading...</div>}>
                    <GetRecentCampaigns />
                  </Suspense>
                  <Suspense fallback={<div>Loading...</div>}>
                    <GetUpcomingRuns />
                  </Suspense>
                  <Suspense fallback={<div>Loading...</div>}>
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
