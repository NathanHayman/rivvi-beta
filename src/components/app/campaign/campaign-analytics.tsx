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
import { BarChart } from "@/components/ui/charts/bar-chart";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/trpc/react";
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Download,
  Loader2,
  MessageCircle,
  Phone,
  User,
  Users,
  VoicemailIcon,
} from "lucide-react";
import { useState } from "react";

interface CampaignAnalyticsProps {
  campaignId: string;
}

export function CampaignAnalytics({ campaignId }: CampaignAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "time" | "runs">(
    "overview",
  );

  // Fetch campaign analytics data
  const { data, isLoading, error } =
    api.dashboard.getCampaignAnalytics.useQuery({
      campaignId,
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
        link.setAttribute("download", `campaign-${campaignId}-report.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
    });

  // Format days of week names
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

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
          Error loading campaign analytics: {error.message}
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{data.overview.name} Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Campaign performance metrics and insights
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            generateReport({
              reportType: "campaigns",
              campaignId,
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

      <Tabs
        defaultValue="overview"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as any)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="time">Time Analysis</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Key metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Patients
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.overview.totalPatients.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Unique patients contacted
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Calls
                </CardTitle>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.overview.totalCalls.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across {data.overview.totalRuns} runs
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Success Rate
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.overview.successRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Patients successfully reached
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Duration
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.overview.averageCallDuration.toFixed(0)}s
                </div>
                <p className="text-xs text-muted-foreground">
                  Average call length
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Call outcomes */}
          <Card>
            <CardHeader>
              <CardTitle>Call Outcomes</CardTitle>
              <CardDescription>Distribution of call results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-center rounded-full bg-primary/10 p-2">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-xl font-bold">
                    {data.callOutcomes.reached.toLocaleString()}
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Patients Reached
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-center rounded-full bg-amber-500/10 p-2">
                    <VoicemailIcon className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="text-xl font-bold">
                    {data.callOutcomes.voicemail.toLocaleString()}
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Voicemails Left
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-center rounded-full bg-blue-500/10 p-2">
                    <MessageCircle className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="text-xl font-bold">
                    {data.callOutcomes.notReached.toLocaleString()}
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Not Reached
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-center rounded-full bg-destructive/10 p-2">
                    <Phone className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="text-xl font-bold">
                    {data.callOutcomes.failed.toLocaleString()}
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Failed Calls
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conversion data */}
          <Card>
            <CardHeader>
              <CardTitle>Conversion Metrics</CardTitle>
              <CardDescription>Campaign goal achievement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium">Conversion Rate</div>
                    <div className="text-sm">
                      {data.conversionData.conversionRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-green-500"
                      style={{
                        width: `${data.conversionData.conversionRate}%`,
                      }}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xl font-bold">
                        {data.conversionData.converted.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Total Conversions
                      </p>
                    </div>
                    <div>
                      <div className="text-xl font-bold">
                        {data.conversionData.notConverted.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Non Conversions
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-medium">
                    Success Indicators
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <span className="text-sm">Patient Reached Rate</span>
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-500"
                      >
                        {data.overview.successRate.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <span className="text-sm">Patient Converted</span>
                      <Badge
                        variant="outline"
                        className="bg-blue-500/10 text-blue-500"
                      >
                        {data.conversionData.conversionRate.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <span className="text-sm">Calls per Patient</span>
                      <Badge variant="outline">
                        {data.overview.totalPatients > 0
                          ? (
                              data.overview.totalCalls /
                              data.overview.totalPatients
                            ).toFixed(1)
                          : "0"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="space-y-4">
          {/* Best time of day */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Best Time of Day</CardTitle>
              <CardDescription>Success rate by hour of the day</CardDescription>
            </CardHeader>
            <CardContent>
              {data.timeAnalysis.bestTimeOfDay &&
              data.timeAnalysis.bestTimeOfDay.length > 0 ? (
                <BarChart
                  data={data.timeAnalysis.bestTimeOfDay.map((hour) => ({
                    hour: `${hour.hour}:00`,
                    "Success Rate": hour.rate * 100,
                    "Call Count": hour.calls,
                  }))}
                  index="hour"
                  categories={["Success Rate"]}
                  colors={["emerald"]}
                  valueFormatter={(value) => `${value.toFixed(1)}%`}
                  showLegend={false}
                  className="h-[300px]"
                />
              ) : (
                <div className="flex h-[300px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No time data available
                  </p>
                </div>
              )}
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-medium">
                  Optimal Calling Hours
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                  {data.timeAnalysis.bestTimeOfDay
                    .sort((a, b) => b.rate - a.rate)
                    .slice(0, 6)
                    .map((hour, index) => (
                      <div
                        key={index}
                        className="rounded-lg border p-2 text-center"
                      >
                        <div className="text-sm font-medium">
                          {hour.hour}:00
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(hour.rate * 100).toFixed(1)}% success
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Best day of week */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Best Day of Week</CardTitle>
              <CardDescription>Success rate by day of the week</CardDescription>
            </CardHeader>
            <CardContent>
              {data.timeAnalysis.bestDayOfWeek &&
              data.timeAnalysis.bestDayOfWeek.length > 0 ? (
                <BarChart
                  data={data.timeAnalysis.bestDayOfWeek.map((day) => ({
                    day: dayNames[day.day],
                    "Success Rate": day.rate * 100,
                    "Call Count": day.calls,
                  }))}
                  index="day"
                  categories={["Success Rate"]}
                  colors={["blue"]}
                  valueFormatter={(value) => `${value.toFixed(1)}%`}
                  showLegend={false}
                  className="h-[300px]"
                />
              ) : (
                <div className="flex h-[300px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No day data available
                  </p>
                </div>
              )}
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-medium">
                  Optimal Calling Days
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {data.timeAnalysis.bestDayOfWeek
                    .sort((a, b) => b.rate - a.rate)
                    .map((day, index) => (
                      <div
                        key={index}
                        className="rounded-lg border p-2 text-center"
                      >
                        <div className="text-sm font-medium">
                          {dayNames[day.day]}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(day.rate * 100).toFixed(1)}% success
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommended scheduling */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended Scheduling</CardTitle>
              <CardDescription>
                Optimal time slots based on historical data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Best Days</p>
                    <p className="text-xs text-muted-foreground">
                      {data.timeAnalysis.bestDayOfWeek
                        .sort((a, b) => b.rate - a.rate)
                        .slice(0, 3)
                        .map((day) => dayNames[day.day])
                        .join(", ")}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Best Hours</p>
                    <p className="text-xs text-muted-foreground">
                      {data.timeAnalysis.bestTimeOfDay
                        .sort((a, b) => b.rate - a.rate)
                        .slice(0, 3)
                        .map((hour) => `${hour.hour}:00`)
                        .join(", ")}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Best Combinations</p>
                    <p className="text-xs text-muted-foreground">
                      {data.timeAnalysis.bestDayOfWeek
                        .sort((a, b) => b.rate - a.rate)
                        .slice(0, 2)
                        .map(
                          (day) =>
                            `${dayNames[day.day]} at ${data.timeAnalysis.bestTimeOfDay
                              .sort((a, b) => b.rate - a.rate)
                              .slice(0, 2)
                              .map((hour) => `${hour.hour}:00`)
                              .join(" or ")}`,
                        )
                        .join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          {/* Run performance table */}
          <Card>
            <CardHeader>
              <CardTitle>Run Performance</CardTitle>
              <CardDescription>
                Comparison of all runs in this campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="grid grid-cols-6 border-b bg-muted/50 p-2 text-sm font-medium">
                  <div className="col-span-2">Run Name</div>
                  <div className="text-right">Calls</div>
                  <div className="text-right">Success</div>
                  <div className="text-right">Conversion</div>
                  <div className="text-right">Status</div>
                </div>
                <div className="divide-y">
                  {data.callsByRun.length > 0 ? (
                    data.callsByRun.map((run, index) => (
                      <div key={index} className="grid grid-cols-6 p-2 text-sm">
                        <div className="col-span-2 truncate font-medium">
                          {run.runName}
                        </div>
                        <div className="text-right">
                          {run.callCount.toLocaleString()}
                        </div>
                        <div className="text-right">
                          {run.successRate.toFixed(1)}%
                        </div>
                        <div className="text-right">
                          {run.conversionRate.toFixed(1)}%
                        </div>
                        <div className="text-right">
                          <Badge
                            variant="outline"
                            className={
                              run.successRate > data.overview.successRate
                                ? "bg-green-500/10 text-green-500"
                                : run.successRate <
                                    data.overview.successRate * 0.8
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-orange-500/10 text-orange-500"
                            }
                          >
                            {run.successRate > data.overview.successRate
                              ? "Above Avg"
                              : run.successRate <
                                  data.overview.successRate * 0.8
                                ? "Poor"
                                : "Average"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No runs found for this campaign
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Success rate is defined as percentage of completed calls where
                patient was reached
              </div>
            </CardContent>
          </Card>

          {/* Run analytics */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Run Comparison</CardTitle>
                <CardDescription>Success rates across runs</CardDescription>
              </CardHeader>
              <CardContent>
                {data.callsByRun.length > 0 ? (
                  <BarChart
                    data={data.callsByRun.slice(0, 10).map((run) => ({
                      run:
                        run.runName.length > 15
                          ? run.runName.substring(0, 15) + "..."
                          : run.runName,
                      "Success Rate": run.successRate,
                    }))}
                    index="run"
                    categories={["Success Rate"]}
                    colors={["emerald"]}
                    valueFormatter={(value) => `${value.toFixed(1)}%`}
                    showLegend={false}
                    className="h-[200px]"
                  />
                ) : (
                  <div className="flex h-[200px] items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      No run data available
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversion by Run</CardTitle>
                <CardDescription>Conversion rates across runs</CardDescription>
              </CardHeader>
              <CardContent>
                {data.callsByRun.length > 0 ? (
                  <BarChart
                    data={data.callsByRun.slice(0, 10).map((run) => ({
                      run:
                        run.runName.length > 15
                          ? run.runName.substring(0, 15) + "..."
                          : run.runName,
                      "Conversion Rate": run.conversionRate,
                    }))}
                    index="run"
                    categories={["Conversion Rate"]}
                    colors={["blue"]}
                    valueFormatter={(value) => `${value.toFixed(1)}%`}
                    showLegend={false}
                    className="h-[200px]"
                  />
                ) : (
                  <div className="flex h-[200px] items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      No run data available
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
