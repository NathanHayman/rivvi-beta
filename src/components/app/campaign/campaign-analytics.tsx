"use client";

import { AppBody, AppContent, AppHeader } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart } from "@/components/ui/charts/bar-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCampaignAnalytics,
  useGenerateCampaignReport,
} from "@/hooks/campaigns/use-campaign-analytics";
import {
  CheckCircle,
  Download,
  Loader2,
  Phone,
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

  // Fetch campaign analytics data using the custom hook
  const { data, isLoading, error } = useCampaignAnalytics(campaignId);

  // Generate report using the custom hook
  const { mutate: generateReport, isPending: isGenerating } =
    useGenerateCampaignReport();

  // Handle report generation
  const handleGenerateReport = () => {
    generateReport(campaignId, {
      onSuccess: (data) => {
        // Convert to CSV
        // Create headers from the data structure
        const headers = ["Metric", "Value"];

        // Create rows from the data
        const rows = [
          // Call metrics
          { Metric: "Total Calls", Value: data.callMetrics.total },
          { Metric: "Completed Calls", Value: data.callMetrics.completed },
          { Metric: "Failed Calls", Value: data.callMetrics.failed },
          { Metric: "Voicemail Calls", Value: data.callMetrics.voicemail },
          { Metric: "In Progress Calls", Value: data.callMetrics.inProgress },
          { Metric: "Pending Calls", Value: data.callMetrics.pending },
          {
            Metric: "Success Rate",
            Value: `${(data.callMetrics.successRate * 100).toFixed(2)}%`,
          },

          // Add conversion metrics
          ...data.conversionMetrics.flatMap((metric) =>
            Object.entries(metric.values).map(([key, value]) => ({
              Metric: `${metric.label} - ${key}`,
              Value: value,
            })),
          ),

          // Add run metrics
          ...data.runMetrics.map((run) => ({
            Metric: `Run: ${run.name}`,
            Value: `${run.completedCalls}/${run.totalCalls} (${(run.conversionRate * 100).toFixed(2)}%)`,
          })),
        ];

        // Convert to CSV
        const csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            headers
              .map((header) => {
                const value = row[header as keyof typeof row];
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
  };

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
    <AppBody>
      <AppHeader
        title={`Campaign Analytics`}
        subtitle="Campaign performance metrics and insights"
        buttons={
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateReport}
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
        }
      />

      <AppContent>
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
                    Total Calls
                  </CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.callMetrics.total.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Campaign call volume
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Completed Calls
                  </CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.callMetrics.completed.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Successfully connected calls
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
                    {data.callMetrics.successRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Patients successfully reached
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Voicemail Calls
                  </CardTitle>
                  <VoicemailIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.callMetrics.voicemail.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Left voicemail messages
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Call outcome charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Call Outcomes</CardTitle>
                  <CardDescription>
                    Distribution of call results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <BarChart
                      data={[
                        {
                          name: "Completed",
                          value: data.callMetrics.completed,
                        },
                        {
                          name: "Voicemail",
                          value: data.callMetrics.voicemail,
                        },
                        {
                          name: "Failed",
                          value: data.callMetrics.failed,
                        },
                        {
                          name: "In Progress",
                          value: data.callMetrics.inProgress,
                        },
                        {
                          name: "Pending",
                          value: data.callMetrics.pending,
                        },
                      ]}
                      index="name"
                      categories={["value"]}
                      colors={["blue", "amber", "pink", "lime", "gray"]}
                    />
                  </div>
                </CardContent>
              </Card>

              {data.conversionMetrics.length > 0 && (
                <Card className="col-span-1">
                  <CardHeader>
                    <CardTitle>Conversion Metrics</CardTitle>
                    <CardDescription>
                      Key performance indicators
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <BarChart
                        data={data.conversionMetrics.map((metric) => {
                          // Find the "true" value for a boolean metric or the first option for an enum
                          const value =
                            metric.type === "boolean"
                              ? metric.values["true"] || 0
                              : metric.values[Object.keys(metric.values)[0]] ||
                                0;

                          return {
                            name: metric.label,
                            value,
                            rate: metric.rate,
                          };
                        })}
                        index="name"
                        categories={["value"]}
                        colors={["emerald"]}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Runs overview */}
            {data.runMetrics.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Runs</CardTitle>
                  <CardDescription>
                    Performance metrics for recent campaign runs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <BarChart
                      data={data.runMetrics.map((run) => ({
                        name: run.name || "Unnamed Run",
                        value: run.totalCalls,
                        completed: run.completedCalls,
                        rate: run.conversionRate,
                      }))}
                      index="name"
                      categories={["value", "completed"]}
                      colors={["blue", "emerald"]}
                      showLegend
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="time" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Call Volume by Time of Day</CardTitle>
                <CardDescription>
                  Distribution of calls throughout the day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <p className="text-center text-sm text-muted-foreground">
                    Time-based analysis is not available for this campaign
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Call Volume by Day of Week</CardTitle>
                <CardDescription>
                  Distribution of calls throughout the week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <p className="text-center text-sm text-muted-foreground">
                    Time-based analysis is not available for this campaign
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs" className="space-y-4">
            {data.runMetrics.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.runMetrics.map((run) => (
                  <Card key={run.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{run.name}</CardTitle>
                      <CardDescription>
                        {run.totalCalls} calls, {run.conversionRate.toFixed(1)}%
                        success
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Calls</p>
                          <p className="font-medium">{run.totalCalls}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Completed</p>
                          <p className="font-medium">{run.completedCalls}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Success Rate</p>
                          <p className="font-medium">
                            {run.conversionRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-muted-foreground">
                      No runs found for this campaign
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </AppContent>
    </AppBody>
  );
}
