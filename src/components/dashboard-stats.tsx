"use client";

import {
  BarChart3,
  Loader2,
  Phone,
  PlayCircle,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { AreaChart } from "./ui/charts/area-chart";
import { BarChart } from "./ui/charts/bar-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface DashboardStatsSimpleProps {
  stats: {
    campaigns: number;
    activeRuns: number;
    completedCalls: number;
    patients: number;
  };
}

// Original simple dashboard stats component
export function DashboardStatsSimple({ stats }: DashboardStatsSimpleProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.campaigns}</div>
          <p className="text-xs text-muted-foreground">
            Active communication campaigns
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Runs</CardTitle>
          <PlayCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeRuns}</div>
          <p className="text-xs text-muted-foreground">
            Currently running campaigns
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed Calls</CardTitle>
          <Phone className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.completedCalls}</div>
          <p className="text-xs text-muted-foreground">Total calls completed</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Patients</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.patients}</div>
          <p className="text-xs text-muted-foreground">Total patient records</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardStats() {
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter">(
    "week",
  );
  const [showSimpleStats, setShowSimpleStats] = useState(false);

  // Use simplified stats if there's an error with the detailed stats
  const { data: simpleStats, isLoading: simpleStatsLoading } =
    api.dashboard.getStats.useQuery(undefined, {
      enabled: showSimpleStats,
      staleTime: 60000,
    });

  // Fetch dashboard data
  const { data, isLoading, error } = api.dashboard.getOrgDashboard.useQuery(
    undefined,
    {
      retry: 1,
      staleTime: 60000,
    },
  );

  // Fetch time-based call analytics
  const { data: timeAnalytics, isLoading: timeLoading } =
    api.dashboard.getCallAnalyticsByTime.useQuery(
      {
        period: dateRange,
      },
      {
        retry: 1,
        staleTime: 60000,
      },
    );

  // Handle errors with useEffect
  useEffect(() => {
    if (error && !showSimpleStats) {
      setShowSimpleStats(true);
    }
  }, [error, showSimpleStats]);

  if (isLoading && !simpleStats) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If there's an error and simple stats are available, show the simple dashboard
  if (error && simpleStats) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
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
        <DashboardStatsSimple stats={simpleStats as any} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-40 w-full flex-col items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">
          Error loading dashboard: {error.message}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href=".">Retry</Link>
        </Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      {/* Summary cards */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Key metrics for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Total Calls</p>
              <p className="text-2xl font-bold">
                {data.calls.total.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.calls.inProgress.toLocaleString()} currently in progress
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Campaigns</p>
              <p className="text-2xl font-bold">
                {data.campaigns.total.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.campaigns.active.toLocaleString()} active
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium leading-none">Reach Rate</p>
                {data.reachRates.trend === "up" ? (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-green-500/10 text-green-500 hover:bg-green-500/20"
                  >
                    <TrendingUp className="h-3 w-3" />
                    Up
                  </Badge>
                ) : data.reachRates.trend === "down" ? (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                  >
                    <TrendingDown className="h-3 w-3" />
                    Down
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    Stable
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold">
                {(data.reachRates.overall * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                Last week: {(data.reachRates.lastWeek * 100).toFixed(1)}%
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">
                Conversion Rate
              </p>
              <p className="text-2xl font-bold">
                {(data.conversionRates.overall * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                Last week: {(data.conversionRates.lastWeek * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Runs Status */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Active Runs</CardTitle>
          <CardDescription>Current runs and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium leading-none">Active</p>
                <p className="text-2xl font-bold">
                  {data.runs.active.toLocaleString()}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium leading-none">Scheduled</p>
                <p className="text-2xl font-bold">
                  {data.runs.scheduled.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex h-9 items-center justify-between">
                <p className="text-sm font-medium">Completion Rate</p>
                <p className="text-sm">
                  {data.runs.total > 0
                    ? `${((data.runs.completed / data.runs.total) * 100).toFixed(0)}%`
                    : "0%"}
                </p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${
                      data.runs.total > 0
                        ? (
                            (data.runs.completed / data.runs.total) *
                            100
                          ).toFixed(0)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Outcomes */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Call Outcomes</CardTitle>
          <CardDescription>Reached, voicemail, and failed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1 text-center">
                <p className="text-xs font-medium text-muted-foreground">
                  Reached
                </p>
                <p className="text-lg font-bold text-primary">
                  {(data.reachRates.overall * 100).toFixed(0)}%
                </p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs font-medium text-muted-foreground">
                  Voicemail
                </p>
                <p className="text-lg font-bold text-amber-500">
                  {(data.voicemailRates.overall * 100).toFixed(0)}%
                </p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs font-medium text-muted-foreground">
                  Failed
                </p>
                <p className="text-lg font-bold text-destructive">
                  {data.calls.total > 0
                    ? ((data.calls.failed / data.calls.total) * 100).toFixed(0)
                    : 0}
                  %
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex h-9 items-center justify-between">
                <p className="text-sm font-medium">Completed Calls</p>
                <p className="text-sm">
                  {data.calls.total > 0
                    ? `${((data.calls.completed / data.calls.total) * 100).toFixed(0)}%`
                    : "0%"}
                </p>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${
                      data.calls.total > 0
                        ? (
                            (data.calls.completed / data.calls.total) *
                            100
                          ).toFixed(0)
                        : 0
                    }%`,
                  }}
                />
                <div
                  className="h-full bg-destructive"
                  style={{
                    width: `${
                      data.calls.total > 0
                        ? (
                            (data.calls.failed / data.calls.total) *
                            100
                          ).toFixed(0)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Volume Chart */}
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle>Call Volume</CardTitle>
          <CardDescription>
            Total calls by day over the past two weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.callVolume.byDay && data.callVolume.byDay.length > 0 ? (
            <AreaChart
              data={data.callVolume.byDay.map((day) => ({
                date: day.date,
                "Total Calls": day.count,
              }))}
              categories={["Total Calls"]}
              index="date"
              colors={["blue"]}
              className="h-[200px]"
              valueFormatter={(value) => `${value.toLocaleString()} calls`}
            />
          ) : (
            <div className="flex h-[200px] items-center justify-center">
              <p className="text-sm text-muted-foreground">
                No call data available for this period
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Analysis */}
      <Card className="lg:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle>Time Analysis</CardTitle>
            <CardDescription>Best times for patient contact</CardDescription>
          </div>
          <div>
            <Tabs defaultValue="week">
              <TabsList className="grid w-[180px] grid-cols-3">
                <TabsTrigger value="week" onClick={() => setDateRange("week")}>
                  Week
                </TabsTrigger>
                <TabsTrigger
                  value="month"
                  onClick={() => setDateRange("month")}
                >
                  Month
                </TabsTrigger>
                <TabsTrigger
                  value="quarter"
                  onClick={() => setDateRange("quarter")}
                >
                  Quarter
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="hour" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="hour">Hour of Day</TabsTrigger>
              <TabsTrigger value="day">Day of Week</TabsTrigger>
            </TabsList>
            <TabsContent value="hour" className="space-y-4">
              {timeLoading ? (
                <div className="flex h-[180px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : timeAnalytics?.byHourOfDay &&
                timeAnalytics.byHourOfDay.length > 0 ? (
                <BarChart
                  data={timeAnalytics.byHourOfDay.map((hour) => ({
                    hour: `${hour.hour}:00`,
                    "Success Rate": hour.rate * 100,
                    "Call Count": hour.total,
                  }))}
                  index="hour"
                  categories={["Success Rate"]}
                  colors={["emerald"]}
                  valueFormatter={(value) => `${value.toFixed(1)}%`}
                  className="h-[180px]"
                />
              ) : (
                <div className="flex h-[180px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No time data available
                  </p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="day" className="space-y-4">
              {timeLoading ? (
                <div className="flex h-[180px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : timeAnalytics?.byDayOfWeek &&
                timeAnalytics.byDayOfWeek.length > 0 ? (
                <BarChart
                  data={timeAnalytics.byDayOfWeek.map((day) => ({
                    day: day.name,
                    "Success Rate": day.rate * 100,
                    "Call Count": day.total,
                  }))}
                  index="day"
                  categories={["Success Rate"]}
                  colors={["blue"]}
                  valueFormatter={(value) => `${value.toFixed(1)}%`}
                  className="h-[180px]"
                />
              ) : (
                <div className="flex h-[180px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No day data available
                  </p>
                </div>
              )}
              <div className="pt-2 text-xs text-muted-foreground">
                Based on{" "}
                {timeAnalytics?.recentTrend.reduce(
                  (sum, day) => sum + day.total,
                  0,
                ) || 0}{" "}
                calls over the selected period
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
