"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/trpc/react";
import { TCampaign } from "@/types/db";
import { format, formatDistance } from "date-fns";
import {
  Activity,
  Calendar,
  FileText,
  Pencil,
  Phone,
  Settings,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreateRunModal } from "../run/create-run-modal";
import { CampaignAnalytics } from "./campaign-analytics";

const campaignTypeColors: Record<string, string> = {
  appointment_confirmation:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  annual_wellness:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  medication_adherence:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  inbound:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export function CampaignDetails({
  campaignId,
  initialData,
}: {
  campaignId: string;
  initialData: TCampaign;
}) {
  const [isCreateRunModalOpen, setIsCreateRunModalOpen] = useState(false);
  const router = useRouter();

  // Check if the user is a super admin
  const { data: superAdminCheck } = api.organizations.isSuperAdmin.useQuery();
  const isSuperAdmin = superAdminCheck?.isSuperAdmin || false;

  const { data: campaign } = api.campaigns.getById.useQuery(
    { id: campaignId },
    {
      initialData: initialData ? { ...initialData } : (undefined as any),
      refetchOnWindowFocus: false,
    },
  );

  const { data: recentRuns } = api.campaigns.getRecentRuns.useQuery(
    { campaignId, limit: 5 },
    { refetchOnWindowFocus: false },
  );

  if (!campaign) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        <div className="text-muted-foreground">Loading campaign details...</div>
      </div>
    );
  }

  const campaignTypeColor =
    campaignTypeColors[campaign.type] || campaignTypeColors.default;

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">{campaign.name}</h2>
            <Badge variant="outline" className={campaignTypeColor}>
              {campaign.type}
            </Badge>
            {!campaign.isActive && (
              <Badge
                variant="outline"
                className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
              >
                Inactive
              </Badge>
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
            <Button onClick={() => setIsCreateRunModalOpen(true)}>
              <Calendar className="mr-1.5 h-4 w-4" />
              Create Run
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Created{" "}
          {formatDistance(new Date(campaign.createdAt), new Date(), {
            addSuffix: true,
          })}
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="mr-1.5 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="runs">
            <Calendar className="mr-1.5 h-4 w-4" />
            Runs
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Runs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {recentRuns?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {recentRuns?.length
                    ? "Latest run created " +
                      formatDistance(
                        new Date(recentRuns[0]?.createdAt || new Date()),
                        new Date(),
                        { addSuffix: true },
                      )
                    : "No runs created yet"}
                </p>
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
                  {recentRuns?.reduce(
                    (acc, run) => acc + (run.metadata?.calls?.total || 0),
                    0,
                  ) || 0}
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
                {(() => {
                  const totalCalls =
                    recentRuns?.reduce(
                      (acc, run) => acc + (run.metadata?.calls?.total || 0),
                      0,
                    ) || 0;
                  const connectedCalls =
                    recentRuns?.reduce(
                      (acc, run) => acc + (run.metadata?.calls?.connected || 0),
                      0,
                    ) || 0;
                  const reachRate =
                    totalCalls > 0
                      ? Math.round((connectedCalls / totalCalls) * 100)
                      : 0;

                  return (
                    <>
                      <div className="text-2xl font-bold">{reachRate}%</div>
                      <p className="text-xs text-muted-foreground">
                        <Users className="mr-1 inline-block h-3 w-3" />
                        {connectedCalls} of {totalCalls} patients reached
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <h3 className="mb-4 text-lg font-medium">Campaign Analytics</h3>
            <CampaignAnalytics campaignId={campaignId} />
          </div>

          <div className="mt-6">
            <h3 className="mb-4 text-lg font-medium">Recent Runs</h3>
            {recentRuns && recentRuns.length > 0 ? (
              <div className="space-y-4">
                {recentRuns.map((run) => (
                  <Card key={run.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <h4 className="font-medium">{run.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Created{" "}
                            {formatDistance(
                              new Date(run.createdAt),
                              new Date(),
                              { addSuffix: true },
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm">
                            <span className="font-medium">
                              {run.metadata?.calls?.completed || 0}
                            </span>
                            <span className="text-muted-foreground">
                              /{run.metadata?.calls?.total || 0} calls
                            </span>
                          </div>
                          <Badge
                            variant={
                              run.status === "completed"
                                ? "success_solid"
                                : run.status === "running"
                                  ? "default"
                                  : run.status === "paused"
                                    ? "failure_solid"
                                    : run.status === "failed"
                                      ? "failure_solid"
                                      : "neutral_solid"
                            }
                          >
                            {run.status}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/campaigns/${campaignId}/runs/${run.id}`,
                              )
                            }
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/campaigns/${campaignId}/runs`)}
                  >
                    View All Runs
                  </Button>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="flex h-40 items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <p>No runs created yet</p>
                    <Button
                      variant="outline"
                      className="mt-2"
                      onClick={() => setIsCreateRunModalOpen(true)}
                    >
                      Create Run
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4 pt-4">
          <div className="flex justify-between">
            <h3 className="text-lg font-medium">Campaign Runs</h3>
            <Button onClick={() => setIsCreateRunModalOpen(true)}>
              Create Run
            </Button>
          </div>

          {recentRuns && recentRuns.length > 0 ? (
            <div className="space-y-4">
              {recentRuns.map((run) => (
                <Card key={run.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between p-4">
                      <div>
                        <h4 className="font-medium">{run.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Created {format(new Date(run.createdAt), "PPP")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                          <div className="text-sm">
                            <span className="font-medium">
                              {run.metadata?.calls?.completed || 0}
                            </span>
                            <span className="text-muted-foreground">
                              /{run.metadata?.calls?.total || 0} calls
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {run.metadata?.calls?.connected || 0} connected
                          </div>
                        </div>
                        <Badge
                          variant={
                            run.status === "completed"
                              ? "success_solid"
                              : run.status === "running"
                                ? "default"
                                : run.status === "paused"
                                  ? "failure_solid"
                                  : run.status === "failed"
                                    ? "failure_solid"
                                    : "neutral_solid"
                          }
                        >
                          {run.status}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/campaigns/${campaignId}/runs/${run.id}`,
                            )
                          }
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex h-40 items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <p>No runs created yet</p>
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => setIsCreateRunModalOpen(true)}
                  >
                    Create First Run
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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
                        {campaign.type}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium">Agent ID</div>
                    <div className="mt-1 truncate font-mono text-sm text-muted-foreground">
                      {campaign.agentId}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium">Status</div>
                    <div className="mt-1">
                      <Badge
                        variant={
                          campaign.isActive ? "success_solid" : "neutral_solid"
                        }
                      >
                        {campaign.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium">Created</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {format(new Date(campaign.createdAt), "PPP")}
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
                    {campaign.config.variables.patient.fields.map((field) => (
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
                    ))}
                  </div>
                </CardContent>
              </Card>

              {campaign.config.variables?.campaign?.fields?.length > 0 && (
                <>
                  <h3 className="text-lg font-medium">Campaign Fields</h3>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {campaign.config.variables?.campaign?.fields?.map(
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
                    {campaign.config.analysis?.standard?.fields?.map(
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

                  {campaign.config.analysis?.campaign?.fields?.length > 0 && (
                    <>
                      <div className="mb-4 mt-6">
                        <h4 className="text-md font-medium">
                          Campaign-Specific Fields
                        </h4>
                      </div>
                      <div className="space-y-4">
                        {campaign.config.analysis?.campaign?.fields?.map(
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
                  {campaign.config.basePrompt || "No prompt configured."}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <CreateRunModal
        campaignId={campaignId}
        open={isCreateRunModalOpen}
        onOpenChange={setIsCreateRunModalOpen}
      />
    </div>
  );
}
