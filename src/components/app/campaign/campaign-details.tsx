"use client";

import {
  RunCreateForm,
  RunCreateFormProps,
} from "@/components/forms/run-create-form";
import { TriggerSheet } from "@/components/modals/trigger-sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ZCampaignWithTemplate } from "@/types/zod";
import { format, formatDistance } from "date-fns";
import {
  Activity,
  BarChart3,
  Calendar,
  FileText,
  Pencil,
  Phone,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
// import { CreateRunModal } from "../run/create-run-modal";

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

export function CampaignDetails({
  campaignId,
  initialData,
  initialRecentRuns = [],
  isSuperAdmin = false,
}: {
  campaignId: string;
  initialData: ZCampaignWithTemplate;
  initialRecentRuns?: RecentRun[];
  isSuperAdmin?: boolean;
}) {
  const [isCreateRunModalOpen, setIsCreateRunModalOpen] = useState(false);
  const router = useRouter();
  const [fullCampaign] = useState<ZCampaignWithTemplate>(initialData);
  const [recentRuns] = useState<RecentRun[]>(initialRecentRuns);

  // Prepare run data for the create run form
  const runData: RunCreateFormProps = {
    campaignId,
    campaignBasePrompt: fullCampaign?.template?.basePrompt,
    campaignVoicemailMessage: fullCampaign?.template?.voicemailMessage,
    campaignName: fullCampaign?.campaign?.name,
    campaignDescription: fullCampaign?.template?.description,
  };

  const campaignTypeColor =
    fullCampaign?.campaign?.direction === "inbound" ||
    fullCampaign?.campaign?.direction === "outbound"
      ? "violet_solid"
      : "yellow_solid";

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
              form={<RunCreateForm {...runData} />}
              buttonIcon={<Calendar className="mr-1.5 h-4 w-4" />}
              title="Create Run"
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
                <div className="text-2xl font-bold">
                  {recentRuns?.length &&
                  recentRuns.some((run) => run.metadata?.calls?.total)
                    ? Math.round(
                        (recentRuns.reduce(
                          (acc, run) =>
                            acc + (run.metadata?.calls?.completed || 0),
                          0,
                        ) /
                          recentRuns.reduce(
                            (acc, run) =>
                              acc + (run.metadata?.calls?.total || 0),
                            0,
                          )) *
                          100,
                      ) + "%"
                    : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  <Users className="mr-1 inline-block h-3 w-3" />
                  Successfully completed calls
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4 pt-4">
          <div className="flex justify-between">
            <h3 className="text-lg font-medium">Recent Runs</h3>
            <Link
              href={`/campaigns/${campaignId}/runs`}
              prefetch={true}
              className={cn(buttonVariants({ variant: "link", size: "sm" }))}
            >
              <span>View All Runs</span>
            </Link>
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
                            {run.metadata?.calls?.completed || 0} completed
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

      {/* <CreateRunModal
        campaignId={campaignId}
        open={isCreateRunModalOpen}
        onOpenChange={setIsCreateRunModalOpen}
      /> */}
    </div>
  );
}
