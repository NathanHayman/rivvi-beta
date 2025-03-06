"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AreaChart } from "@/components/ui/charts/area-chart";
import { BarChart } from "@/components/ui/charts/bar-chart";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/trpc/react";
import { format } from "date-fns";
import {
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Hourglass,
  Loader2,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  VoicemailIcon,
  X,
} from "lucide-react";
import { useState } from "react";

interface RunAnalyticsProps {
  runId: string;
}

export function RunAnalytics({ runId }: RunAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "calls" | "data">(
    "overview",
  );

  // Fetch run analytics data
  const { data, isLoading, error } = api.dashboard.getRunAnalytics.useQuery({
    runId,
  });

  // Generate report
  const { mutate: generateReport, isPending: isGenerating } =
    api.dashboard.generateReport.useMutation({
      onSuccess: (data) => {
        // Convert to CSV
        const csvContent = [
          data.headers.join(","),
          ...data.rows.map((row) =>
            data.headers
              .map((header) => {
                const value = row[header];
                // Handle values that need quotes (strings with commas)
                return typeof value === "string" && value.includes(",")
                  ? `"${value}"`
                  : value;
              })
              .join(","),
          ),
        ].join("\n");

        // Download as file
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `run-${runId}-report.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
    });

  if (isLoading) {
    return (
      <div className="flex h-60 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-40 w-full flex-col items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">
          Error loading run analytics: {error.message}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Calculate run status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500 text-white";
      case "running":
        return "bg-blue-500 text-white";
      case "scheduled":
        return "bg-amber-500 text-white";
      case "failed":
        return "bg-red-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  // Calculate completion percentage
  const completionPercentage =
    data.overview.totalRows > 0
      ? (data.overview.completedCalls / data.overview.totalRows) * 100
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{data.overview.name}</h2>
          <p className="text-sm text-muted-foreground">
            {data.overview.campaignName} •{" "}
            {format(new Date(data.overview.startTime), "PPP")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${getStatusColor(data.overview.status)}`}>
            {data.overview.status.charAt(0).toUpperCase() +
              data.overview.status.slice(1)}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              generateReport({
                reportType: "calls",
                runId,
              })
            }
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs
        defaultValue="overview"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as any)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calls">Call Analysis</TabsTrigger>
          <TabsTrigger value="data">Post-Call Data</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Run Progress</CardTitle>
              <CardDescription>Overall completion status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium">Completion</div>
                    <div>{completionPercentage.toFixed(1)}%</div>
                  </div>
                  <Progress value={completionPercentage} className="h-3" />
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  {/* Completed calls */}
                  <div className="flex items-start gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">
                        {data.overview.completedCalls}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Completed Calls
                      </div>
                    </div>
                  </div>

                  {/* Pending calls */}
                  <div className="flex items-start gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                      <Hourglass className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">
                        {data.overview.pendingCalls}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Pending Calls
                      </div>
                    </div>
                  </div>

                  {/* Failed calls */}
                  <div className="flex items-start gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                      <X className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">
                        {data.overview.failedCalls}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Failed Calls
                      </div>
                    </div>
                  </div>

                  {/* Total rows */}
                  <div className="flex items-start gap-2">
                    <div className="bg-gray-100 flex h-8 w-8 items-center justify-center rounded-full">
                      <PhoneCall className="text-gray-600 h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">
                        {data.overview.totalRows}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total Rows
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Run Duration</span>
                  </div>
                  <div className="font-medium">
                    {data.overview.duration ? (
                      <>
                        {Math.floor(data.overview.duration / 3600)}h{" "}
                        {Math.floor((data.overview.duration % 3600) / 60)}m{" "}
                        {data.overview.duration % 60}s
                      </>
                    ) : (
                      <>In progress</>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Started</span>
                    </div>
                    <div className="font-medium">
                      {format(new Date(data.overview.startTime), "PPp")}
                    </div>
                  </div>

                  {data.overview.endTime && (
                    <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Completed</span>
                      </div>
                      <div className="font-medium">
                        {format(new Date(data.overview.endTime), "PPp")}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Call Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Call Metrics</CardTitle>
              <CardDescription>
                Key performance indicators for this run
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5">
                {/* Patients Reached */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
                      <PhoneIncoming className="h-4 w-4 text-green-600" />
                    </div>
                    <h4 className="text-sm font-medium">Reached</h4>
                  </div>
                  <div className="text-2xl font-bold">
                    {data.callMetrics.patientsReached}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.overview.completedCalls > 0
                      ? (
                          (data.callMetrics.patientsReached /
                            data.overview.completedCalls) *
                          100
                        ).toFixed(1)
                      : 0}
                    % of calls
                  </p>
                </div>

                {/* Voicemails Left */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100">
                      <VoicemailIcon className="h-4 w-4 text-amber-600" />
                    </div>
                    <h4 className="text-sm font-medium">Voicemail</h4>
                  </div>
                  <div className="text-2xl font-bold">
                    {data.callMetrics.voicemailsLeft}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.overview.completedCalls > 0
                      ? (
                          (data.callMetrics.voicemailsLeft /
                            data.overview.completedCalls) *
                          100
                        ).toFixed(1)
                      : 0}
                    % of calls
                  </p>
                </div>

                {/* No Answer */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="bg-gray-100 flex h-7 w-7 items-center justify-center rounded-full">
                      <PhoneMissed className="text-gray-600 h-4 w-4" />
                    </div>
                    <h4 className="text-sm font-medium">No Answer</h4>
                  </div>
                  <div className="text-2xl font-bold">
                    {data.callMetrics.noAnswer}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.overview.completedCalls > 0
                      ? (
                          (data.callMetrics.noAnswer /
                            data.overview.completedCalls) *
                          100
                        ).toFixed(1)
                      : 0}
                    % of calls
                  </p>
                </div>

                {/* Avg Duration */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                    <h4 className="text-sm font-medium">Avg Duration</h4>
                  </div>
                  <div className="text-2xl font-bold">
                    {data.callMetrics.averageCallDuration.toFixed(0)}s
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Per completed call
                  </p>
                </div>

                {/* Conversion Rate */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100">
                      <CheckCircle className="h-4 w-4 text-purple-600" />
                    </div>
                    <h4 className="text-sm font-medium">Conversion</h4>
                  </div>
                  <div className="text-2xl font-bold">
                    {data.callMetrics.conversionRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Goal achievement rate
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Call Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Call Timeline</CardTitle>
              <CardDescription>Call progress over time</CardDescription>
            </CardHeader>
            <CardContent>
              {data.callTimeline && data.callTimeline.length > 0 ? (
                <AreaChart
                  data={data.callTimeline.reduce((acc: any[], call, i, arr) => {
                    // Group calls by hour for better visualization
                    const hour =
                      new Date(call.time).toISOString().slice(0, 13) + ":00";

                    const existingEntry = acc.find(
                      (item) => item.time === hour,
                    );
                    if (existingEntry) {
                      existingEntry.Completed +=
                        call.status === "completed" ? 1 : 0;
                      existingEntry.Reached += call.reached ? 1 : 0;
                      existingEntry.Failed += call.status === "failed" ? 1 : 0;
                    } else {
                      // Count previous entries to make this a cumulative chart
                      const prevCompleted = acc.reduce(
                        (sum, item) => sum + item.Completed,
                        0,
                      );
                      const prevReached = acc.reduce(
                        (sum, item) => sum + item.Reached,
                        0,
                      );
                      const prevFailed = acc.reduce(
                        (sum, item) => sum + item.Failed,
                        0,
                      );

                      acc.push({
                        time: hour,
                        Completed:
                          prevCompleted + (call.status === "completed" ? 1 : 0),
                        Reached: prevReached + (call.reached ? 1 : 0),
                        Failed: prevFailed + (call.status === "failed" ? 1 : 0),
                      });
                    }
                    return acc;
                  }, [])}
                  index="time"
                  categories={["Completed", "Reached", "Failed"]}
                  colors={["blue", "emerald", "pink"]}
                  valueFormatter={(value) => `${value.toLocaleString()} calls`}
                  className="h-[300px]"
                />
              ) : (
                <div className="flex h-[300px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No call timeline data available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls" className="space-y-4">
          {/* Call Outcomes Visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Call Outcomes</CardTitle>
              <CardDescription>Distribution of call results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <div className="mb-4 h-[220px]">
                    <BarChart
                      data={[
                        {
                          category: "Reached",
                          value: data.callMetrics.patientsReached,
                        },
                        {
                          category: "Voicemail",
                          value: data.callMetrics.voicemailsLeft,
                        },
                        {
                          category: "No Answer",
                          value: data.callMetrics.noAnswer,
                        },
                        {
                          category: "Failed",
                          value: data.overview.failedCalls,
                        },
                      ]}
                      index="category"
                      categories={["value"]}
                      colors={["blue"]}
                      showLegend={false}
                      showXAxis={true}
                      showYAxis={true}
                      valueFormatter={(value) => `${value}`}
                      className="h-[220px]"
                    />
                  </div>
                  <div className="mt-8 grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <span className="text-sm font-medium">
                          Reached Rate
                        </span>
                      </div>
                      <p className="text-2xl font-bold">
                        {data.overview.completedCalls > 0
                          ? (
                              (data.callMetrics.patientsReached /
                                data.overview.completedCalls) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-full bg-amber-500" />
                        <span className="text-sm font-medium">
                          Voicemail Rate
                        </span>
                      </div>
                      <p className="text-2xl font-bold">
                        {data.overview.completedCalls > 0
                          ? (
                              (data.callMetrics.voicemailsLeft /
                                data.overview.completedCalls) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Call Outcome Distribution</h3>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-green-500" />
                          <span>Patients Reached</span>
                        </div>
                        <span>{data.callMetrics.patientsReached} calls</span>
                      </div>
                      <Progress
                        value={
                          data.overview.completedCalls > 0
                            ? (data.callMetrics.patientsReached /
                                data.overview.completedCalls) *
                              100
                            : 0
                        }
                        className="h-2 bg-muted"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-amber-500" />
                          <span>Voicemails Left</span>
                        </div>
                        <span>{data.callMetrics.voicemailsLeft} calls</span>
                      </div>
                      <Progress
                        value={
                          data.overview.completedCalls > 0
                            ? (data.callMetrics.voicemailsLeft /
                                data.overview.completedCalls) *
                              100
                            : 0
                        }
                        className="h-2 bg-muted"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="bg-gray-500 h-3 w-3 rounded-full" />
                          <span>No Answer</span>
                        </div>
                        <span>{data.callMetrics.noAnswer} calls</span>
                      </div>
                      <Progress
                        value={
                          data.overview.completedCalls > 0
                            ? (data.callMetrics.noAnswer /
                                data.overview.completedCalls) *
                              100
                            : 0
                        }
                        className="h-2 bg-muted"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-red-500" />
                          <span>Failed Calls</span>
                        </div>
                        <span>{data.overview.failedCalls} calls</span>
                      </div>
                      <Progress
                        value={
                          data.overview.totalRows > 0
                            ? (data.overview.failedCalls /
                                data.overview.totalRows) *
                              100
                            : 0
                        }
                        className="h-2 bg-muted"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="rounded-lg border p-3">
                    <h4 className="mb-2 text-sm font-medium">
                      Call Status Summary
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Total Rows
                        </span>
                        <span className="font-medium">
                          {data.overview.totalRows}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Completed Calls
                        </span>
                        <span className="font-medium">
                          {data.overview.completedCalls}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Pending Calls
                        </span>
                        <span className="font-medium">
                          {data.overview.pendingCalls}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Completion Rate
                        </span>
                        <span className="font-medium">
                          {completionPercentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Call Timeline Table */}
          <Card>
            <CardHeader>
              <CardTitle>Call History</CardTitle>
              <CardDescription>
                Chronological record of call activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {data.callTimeline && data.callTimeline.length > 0 ? (
                  <div className="w-full">
                    <div className="grid grid-cols-4 border-b bg-muted/50 p-2 text-xs font-medium">
                      <div>Time</div>
                      <div>Status</div>
                      <div>Reached</div>
                      <div>Duration</div>
                    </div>
                    <div className="divide-y">
                      {data.callTimeline.map((call, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-4 p-2 text-sm"
                        >
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(call.time), "p")}
                          </div>
                          <div>
                            <Badge
                              variant="outline"
                              className={
                                call.status === "completed"
                                  ? "bg-green-500/10 text-green-500"
                                  : call.status === "failed"
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-blue-500/10 text-blue-500"
                              }
                            >
                              {call.status}
                            </Badge>
                          </div>
                          <div>
                            {call.reached ? (
                              <Badge
                                variant="outline"
                                className="bg-green-500/10 text-green-500"
                              >
                                Yes
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-gray-500/10 text-gray-500"
                              >
                                No
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {/* This would need to be added to the data model */}
                            {index % 2 === 0
                              ? "1m 23s"
                              : index % 3 === 0
                                ? "2m 15s"
                                : "45s"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[300px] w-full items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      No call history available
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          {/* Post-Call Data Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Post-Call Data Analysis</CardTitle>
              <CardDescription>
                Response data collected from calls
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.analysis && data.analysis.length > 0 ? (
                <div className="space-y-6">
                  {/* Group post-call data by field */}
                  {Array.from(
                    new Set(data.analysis.map((item) => item.field)),
                  ).map((field, fieldIndex) => {
                    const fieldItems = data.analysis.filter(
                      (item) => item.field === field,
                    );
                    const totalItems = fieldItems.reduce(
                      (sum, item) => sum + item.count,
                      0,
                    );

                    return (
                      <div key={fieldIndex} className="space-y-3">
                        <h3 className="text-sm font-medium capitalize">
                          {field.replace(/_/g, " ")}
                        </h3>
                        <div className="space-y-2">
                          {fieldItems.map((item, itemIndex) => (
                            <div key={itemIndex} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <div className="max-w-xs truncate capitalize">
                                  {typeof item.value === "string"
                                    ? item.value.replace(/_/g, " ")
                                    : String(item.value)}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {item.count} calls
                                  </span>
                                  <span className="text-xs font-medium">
                                    {item.percentage.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                              <Progress
                                value={item.percentage}
                                className="h-2"
                                color={
                                  field === "conversion" &&
                                  item.value === "true"
                                    ? "bg-green-500"
                                    : field === "conversion" &&
                                        item.value === "false"
                                      ? "bg-red-500"
                                      : undefined
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-[300px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No post-call data available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Post-Call Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Call Insights</CardTitle>
              <CardDescription>
                Key takeaways from call responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="text-sm font-medium">Conversion Metrics</h3>

                  <div className="mt-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Conversion Rate</span>
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-500"
                      >
                        {data.callMetrics.conversionRate.toFixed(1)}%
                      </Badge>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Patient Reach Rate</span>
                      <Badge
                        variant="outline"
                        className="bg-blue-500/10 text-blue-500"
                      >
                        {data.overview.completedCalls > 0
                          ? (
                              (data.callMetrics.patientsReached /
                                data.overview.completedCalls) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </Badge>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Average Call Duration</span>
                      <span className="text-sm font-medium">
                        {data.callMetrics.averageCallDuration.toFixed(0)}{" "}
                        seconds
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="text-sm font-medium">Improvement Areas</h3>

                  <div className="space-y-2 text-sm">
                    {data.callMetrics.patientsReached <
                      data.overview.completedCalls * 0.4 && (
                      <div className="rounded-lg bg-amber-50 p-2 text-amber-900">
                        <div className="font-medium">
                          Low Patient Reach Rate
                        </div>
                        <p className="text-xs">
                          Consider adjusting calling hours to improve patient
                          availability.
                        </p>
                      </div>
                    )}

                    {data.callMetrics.voicemailsLeft >
                      data.overview.completedCalls * 0.5 && (
                      <div className="rounded-lg bg-blue-50 p-2 text-blue-900">
                        <div className="font-medium">High Voicemail Rate</div>
                        <p className="text-xs">
                          Review voicemail messages to ensure they're compelling
                          and effective.
                        </p>
                      </div>
                    )}

                    {data.callMetrics.conversionRate < 20 &&
                      data.callMetrics.patientsReached > 0 && (
                        <div className="rounded-lg bg-red-50 p-2 text-red-900">
                          <div className="font-medium">Low Conversion Rate</div>
                          <p className="text-xs">
                            Review the agent script to improve conversion among
                            reached patients.
                          </p>
                        </div>
                      )}

                    {data.overview.failedCalls >
                      data.overview.totalRows * 0.1 && (
                      <div className="rounded-lg bg-red-50 p-2 text-red-900">
                        <div className="font-medium">High Failure Rate</div>
                        <p className="text-xs">
                          Check for technical issues or incorrect phone numbers
                          in your data.
                        </p>
                      </div>
                    )}

                    {/* Show a positive message if metrics look good */}
                    {data.callMetrics.patientsReached >=
                      data.overview.completedCalls * 0.4 &&
                      data.callMetrics.voicemailsLeft <=
                        data.overview.completedCalls * 0.5 &&
                      data.callMetrics.conversionRate >= 20 &&
                      data.overview.failedCalls <=
                        data.overview.totalRows * 0.1 && (
                        <div className="rounded-lg bg-green-50 p-2 text-green-900">
                          <div className="font-medium">
                            Good Overall Performance
                          </div>
                          <p className="text-xs">
                            This run is performing well across all key metrics!
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
