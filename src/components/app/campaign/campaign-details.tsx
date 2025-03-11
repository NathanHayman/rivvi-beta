"use client";

import {
  RunCreateForm,
  RunCreateFormProps,
} from "@/components/forms/create-run-form/form";
import { CreateRunAction } from "@/components/modals/actions/create-run";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ZCampaignWithTemplate } from "@/types/zod";
import { format, formatDistance } from "date-fns";
import {
  Activity,
  BarChart3,
  Calendar,
  ChevronRight,
  FileText,
  Pencil,
  Phone,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type RecentRun = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  metadata?: {
    calls?: {
      total: number;
      completed: number;
      failed: number;
    };
  };
};

// Add badge variant types and helper function
type BadgeVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "success_solid"
  | "failure_solid"
  | "neutral_solid";

function getStatusBadgeVariant(status: string): string {
  switch (status) {
    case "completed":
      return "success_solid";
    case "running":
      return "default";
    case "paused":
      return "neutral_solid";
    case "failed":
      return "failure_solid";
    case "scheduled":
      return "secondary";
    default:
      return "outline";
  }
}

export function CampaignDetails({
  campaignId,
  initialData,
  initialConfig,
  initialRecentRuns = [],
  isSuperAdmin = false,
}: {
  campaignId: string;
  initialData: ZCampaignWithTemplate;
  initialConfig: RunCreateFormProps;
  initialRecentRuns?: RecentRun[];
  isSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const [isCreateRunModalOpen, setIsCreateRunModalOpen] = useState(false);
  const [fullCampaign] = useState<ZCampaignWithTemplate>(initialData);
  const [recentRuns] = useState<RecentRun[]>(initialRecentRuns);
  const [campaignAnalytics, setCampaignAnalytics] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const campaignTypeColor =
    fullCampaign?.campaign?.direction === "inbound" ||
    fullCampaign?.campaign?.direction === "outbound"
      ? "violet_solid"
      : "yellow_solid";

  // Fetch campaign analytics
  useEffect(() => {
    async function fetchAnalytics() {
      setIsLoadingAnalytics(true);
      try {
        // Use dynamic import to avoid issues with the module not being available
        const analyticsModule = await import("@/server/actions/runs/analytics");
        if (analyticsModule && analyticsModule.getCampaignAnalytics) {
          const data = await analyticsModule.getCampaignAnalytics(campaignId);
          if (data) {
            setCampaignAnalytics(data);
          }
        }
      } catch (error) {
        console.error("Error fetching campaign analytics:", error);
      } finally {
        setIsLoadingAnalytics(false);
      }
    }

    fetchAnalytics();
  }, [campaignId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">{fullCampaign.campaign.name}</h2>
            <Badge variant={campaignTypeColor}>
              {fullCampaign.campaign.direction}
            </Badge>
            {!fullCampaign.campaign.isActive && (
              <Badge variant="neutral_solid">Inactive</Badge>
            )}
          </div>
          <div className="flex gap-2">
            {isSuperAdmin && (
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/admin/campaigns/${campaignId}/edit`)
                }
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit Campaign
              </Button>
            )}
            <Link
              href={`/campaigns/${campaignId}/analytics`}
              prefetch={true}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              <BarChart3 className="mr-1.5 h-4 w-4" />
              <span>Analytics</span>
            </Link>
            <TriggerSheet
              buttonText="Create Run"
              form={<RunCreateForm {...initialConfig} />}
              buttonIcon={<Calendar className="mr-1.5 h-4 w-4" />}
              title="Create Run"
            />
            <CreateRunAction
              type="modal"
              form={<RunCreateForm {...initialConfig} />}
              title="Create Run"
              buttonText="Create Run"
              buttonIcon={<Calendar className="mr-1.5 h-4 w-4" />}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Created{" "}
          {formatDistance(
            new Date(fullCampaign.campaign.createdAt),
            new Date(),
            {
              addSuffix: true,
            },
          )}
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="mr-1.5 h-4 w-4" />
            Overview
          </TabsTrigger>
          {isSuperAdmin && (
            <>
              <TabsTrigger value="configuration">
                <Settings className="mr-1.5 h-4 w-4" />
                Configuration
              </TabsTrigger>
              <TabsTrigger value="prompt">
                <FileText className="mr-1.5 h-4 w-4" />
                Prompt
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Campaign Stats Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Campaign Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Calls</span>
                    <span className="font-medium">
                      {isLoadingAnalytics ? (
                        <Skeleton className="h-4 w-8" />
                      ) : (
                        campaignAnalytics?.callMetrics?.total || 0
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Completed Calls</span>
                    <span className="font-medium">
                      {isLoadingAnalytics ? (
                        <Skeleton className="h-4 w-8" />
                      ) : (
                        campaignAnalytics?.callMetrics?.completed || 0
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Patient Reached</span>
                    <span className="font-medium">
                      {isLoadingAnalytics ? (
                        <Skeleton className="h-4 w-8" />
                      ) : (
                        <span>
                          {campaignAnalytics?.callMetrics?.successRate
                            ? campaignAnalytics.callMetrics.successRate.toFixed(
                                1,
                              )
                            : "0"}
                          %
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaignAnalytics?.callMetrics?.total || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  <Phone className="mr-1 inline-block h-3 w-3" />
                  Across all runs
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Patient Reach Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaignAnalytics?.callMetrics?.successRate
                    ? campaignAnalytics.callMetrics.successRate.toFixed(1)
                    : "0"}
                  %
                </div>
                <p className="text-xs text-muted-foreground">
                  <Users className="mr-1 inline-block h-3 w-3" />
                  Successfully completed calls
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Runs Section */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Runs</CardTitle>
                  <Link
                    href={`/campaigns/${campaignId}/runs`}
                    className="text-sm text-primary hover:underline"
                  >
                    View all runs
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {recentRuns && recentRuns.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Calls</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentRuns.map((run) => {
                        // Find analytics for this run if available
                        const runMetrics = campaignAnalytics?.runMetrics?.find(
                          (r: any) => r.id === run.id,
                        );

                        return (
                          <TableRow key={run.id}>
                            <TableCell>
                              <div className="font-medium">{run.name}</div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  getStatusBadgeVariant(
                                    run.status,
                                  ) as BadgeVariant
                                }
                              >
                                {run.status.charAt(0).toUpperCase() +
                                  run.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isLoadingAnalytics ? (
                                <Skeleton className="h-4 w-12" />
                              ) : (
                                `${runMetrics?.completedCalls || 0} of ${runMetrics?.totalCalls || 0}`
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">
                                {formatDistance(
                                  new Date(run.createdAt),
                                  new Date(),
                                  { addSuffix: true },
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`/campaigns/${campaignId}/runs/${run.id}`}
                                prefetch={false}
                              >
                                <Button variant="ghost" size="icon" asChild>
                                  <div>
                                    <ChevronRight className="h-4 w-4" />
                                    <span className="sr-only">View</span>
                                  </div>
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center">
                    <p className="mb-2 text-sm text-muted-foreground">
                      No runs yet
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setIsCreateRunModalOpen(true)}
                    >
                      <Calendar className="mr-1.5 h-4 w-4" />
                      Create Run
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="configuration" className="space-y-6 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium">Campaign Type</div>
                    <div className="mt-1">
                      <Badge variant="outline" className={campaignTypeColor}>
                        {fullCampaign.campaign.direction}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium">Agent ID</div>
                    <div className="mt-1 truncate font-mono text-sm text-muted-foreground">
                      {fullCampaign.template?.agentId}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium">Status</div>
                    <div className="mt-1">
                      <Badge
                        variant={
                          fullCampaign.campaign.isActive
                            ? "success_solid"
                            : "neutral_solid"
                        }
                      >
                        {fullCampaign.campaign.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium">Created</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {format(new Date(fullCampaign.campaign.createdAt), "PPP")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Patient Fields</h3>
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {fullCampaign.template?.variablesConfig.patient.fields.map(
                      (field) => (
                        <div
                          key={field.key}
                          className="grid gap-2 sm:grid-cols-3"
                        >
                          <div>
                            <div className="font-medium">{field.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {field.key}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground sm:col-span-2">
                            <div className="flex flex-wrap gap-2">
                              {field.required && (
                                <Badge
                                  variant="success_outline"
                                  className="text-xs"
                                >
                                  Required
                                </Badge>
                              )}
                              {field.transform && (
                                <Badge variant="secondary" className="text-xs">
                                  Transform: {field.transform}
                                </Badge>
                              )}
                            </div>
                            {field.description && (
                              <p className="mt-1">{field.description}</p>
                            )}
                            <div className="mt-1">
                              <span className="text-xs font-medium">
                                Possible columns:{" "}
                              </span>
                              <span className="text-xs">
                                {field.possibleColumns.join(", ")}
                              </span>
                            </div>
                          </div>
                          <div className="sm:col-span-3">
                            <Separator />
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>

              {fullCampaign.template?.variablesConfig.campaign.fields.length >
                0 && (
                <>
                  <h3 className="text-lg font-medium">Campaign Fields</h3>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {fullCampaign.template?.variablesConfig.campaign.fields.map(
                          (field) => (
                            <div
                              key={field.key}
                              className="grid gap-2 sm:grid-cols-3"
                            >
                              <div>
                                <div className="font-medium">{field.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {field.key}
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground sm:col-span-2">
                                <div className="flex flex-wrap gap-2">
                                  {field.required && (
                                    <Badge
                                      variant="success_outline"
                                      className="text-xs"
                                    >
                                      Required
                                    </Badge>
                                  )}
                                  {field.transform && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Transform: {field.transform}
                                    </Badge>
                                  )}
                                </div>
                                {field.description && (
                                  <p className="mt-1">{field.description}</p>
                                )}
                                <div className="mt-1">
                                  <span className="text-xs font-medium">
                                    Possible columns:{" "}
                                  </span>
                                  <span className="text-xs">
                                    {field.possibleColumns.join(", ")}
                                  </span>
                                </div>
                              </div>
                              <div className="sm:col-span-3">
                                <Separator />
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              <h3 className="text-lg font-medium">Post-Call Data</h3>
              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4">
                    <h4 className="text-md font-medium">Standard Fields</h4>
                  </div>
                  <div className="space-y-4">
                    {fullCampaign.template?.analysisConfig.standard?.fields?.map(
                      (field) => (
                        <div
                          key={field.key}
                          className="grid gap-2 sm:grid-cols-3"
                        >
                          <div>
                            <div className="font-medium">{field.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {field.key}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground sm:col-span-2">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="text-xs">
                                Type: {field.type}
                              </Badge>
                              {field.required && (
                                <Badge
                                  variant="success_outline"
                                  className="text-xs"
                                >
                                  Required
                                </Badge>
                              )}
                            </div>
                            {field.description && (
                              <p className="mt-1">{field.description}</p>
                            )}
                            {field.options && field.options.length > 0 && (
                              <div className="mt-1">
                                <span className="text-xs font-medium">
                                  Options:{" "}
                                </span>
                                <span className="text-xs">
                                  {field.options.join(", ")}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="sm:col-span-3">
                            <Separator />
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  {fullCampaign.template?.analysisConfig.campaign?.fields
                    ?.length > 0 && (
                    <>
                      <div className="mb-4 mt-6">
                        <h4 className="text-md font-medium">
                          Campaign-Specific Fields
                        </h4>
                      </div>
                      <div className="space-y-4">
                        {fullCampaign.template?.analysisConfig.campaign?.fields?.map(
                          (field) => (
                            <div
                              key={field.key}
                              className="grid gap-2 sm:grid-cols-3"
                            >
                              <div>
                                <div className="font-medium">{field.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {field.key}
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground sm:col-span-2">
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    Type: {field.type}
                                  </Badge>
                                  {field.required && (
                                    <Badge
                                      variant="success_outline"
                                      className="text-xs"
                                    >
                                      Required
                                    </Badge>
                                  )}
                                  {field.isMainKPI && (
                                    <Badge
                                      variant="success_solid"
                                      className="text-xs"
                                    >
                                      Main KPI
                                    </Badge>
                                  )}
                                </div>
                                {field.description && (
                                  <p className="mt-1">{field.description}</p>
                                )}
                                {field.options && field.options.length > 0 && (
                                  <div className="mt-1">
                                    <span className="text-xs font-medium">
                                      Options:{" "}
                                    </span>
                                    <span className="text-xs">
                                      {field.options.join(", ")}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="sm:col-span-3">
                                <Separator />
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="prompt" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Call Script</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
                  {fullCampaign.template?.basePrompt || "No prompt configured."}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export function CampaignDetailsSkeleton() {
  return <div>CampaignDetailsSkeleton</div>;
}
