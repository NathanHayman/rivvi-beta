"use client";

// src/components/campaigns/campaign-card.tsx
import {
  ArrowUpRight,
  BarChart3,
  CalendarIcon,
  Clock,
  ListIcon,
  Phone,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDistance } from "date-fns";
import { CreateRunModal } from "../run/create-run-modal";

interface CampaignCardProps {
  campaign: {
    id: string;
    name: string;
    type: string;
    agentId: string;
    createdAt: Date;
  };
  recentRuns?: Array<{
    id: string;
    name: string;
    status: string;
    metadata?: {
      rows?: {
        total?: number;
      };
      calls?: {
        total?: number;
        completed?: number;
        voicemail?: number;
        connected?: number;
        converted?: number;
      };
    };
    createdAt: Date;
  }>;
  className?: string;
}

export function CampaignCard({
  campaign,
  recentRuns = [],
  className,
}: CampaignCardProps) {
  const router = useRouter();
  const [isCreateRunModalOpen, setIsCreateRunModalOpen] = useState(false);

  const handleViewCampaign = () => {
    router.push(`/campaigns/${campaign.id}`);
  };

  const handleViewRuns = () => {
    router.push(`/campaigns/${campaign.id}/runs`);
  };

  // Get the most recent run
  const latestRun = recentRuns[0];

  // Calculate stats for latest run
  const totalCalls = latestRun?.metadata?.calls?.total || 0;
  const completedCalls = latestRun?.metadata?.calls?.completed || 0;
  const completionRate =
    totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;

  const campaignTypeColor =
    campaign.type === "appointment_confirmation"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      : campaign.type === "annual_wellness"
        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
        : campaign.type === "medication_adherence"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
          : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-1.5">
              {campaign.name}
            </CardTitle>
            <Badge variant="outline" className={campaignTypeColor}>
              {campaign.type}
            </Badge>
          </div>
          <CardDescription>
            Created{" "}
            {formatDistance(new Date(campaign.createdAt), new Date(), {
              addSuffix: true,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0">
          {latestRun ? (
            <div className="grid gap-2">
              <div className="text-sm font-medium">
                Latest Run: {latestRun.name}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ListIcon className="h-3.5 w-3.5" />
                  <span>{latestRun.metadata?.rows?.total || 0} rows</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>
                    {completedCalls}/{totalCalls} calls
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>{completionRate}% complete</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {formatDistance(new Date(latestRun.createdAt), new Date(), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>

              <div className="mt-2">
                <Badge
                  variant={
                    latestRun.status === "completed"
                      ? "success_solid"
                      : latestRun.status === "running"
                        ? "default"
                        : latestRun.status === "paused"
                          ? "failure_solid"
                          : latestRun.status === "failed"
                            ? "failure_solid"
                            : "neutral_solid"
                  }
                >
                  {latestRun.status}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No runs created yet
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" size="sm" onClick={handleViewCampaign}>
            View Details
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleViewRuns}>
              <span className="mr-1">Runs</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsCreateRunModalOpen(true)}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              Create Run
            </Button>
          </div>
        </CardFooter>
      </Card>

      <CreateRunModal
        campaignId={campaign.id}
        open={isCreateRunModalOpen}
        onOpenChange={setIsCreateRunModalOpen}
      />
    </>
  );
}
