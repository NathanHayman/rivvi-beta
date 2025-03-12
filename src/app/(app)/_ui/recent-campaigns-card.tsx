"use client";

import { formatDistance } from "date-fns";
import { ArrowUpRight, CalendarIcon } from "lucide-react";
import Link from "next/link";

import { RunCreateForm } from "@/components/forms/create-run-form/form";
import { CreateRunAction } from "@/components/modals/actions/create-run";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ZCampaignWithTemplate } from "@/types/zod";
import { useState } from "react";

interface RecentCampaignsCardProps {
  campaigns: ZCampaignWithTemplate[];
}

export function RecentCampaignsCard({ campaigns }: RecentCampaignsCardProps) {
  const [selectedCampaign, setSelectedCampaign] =
    useState<ZCampaignWithTemplate | null>(null);
  const [isCreateRunModalOpen, setIsCreateRunModalOpen] = useState(false);

  const handleCreateRun = (campaign: ZCampaignWithTemplate) => {
    setSelectedCampaign(campaign);
    setIsCreateRunModalOpen(true);
  };

  const getCampaignTypeColor = (direction: string) => {
    switch (direction) {
      case "outbound":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "inbound":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  return (
    <>
      <Card className="col-span-1">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium">
            Recent Campaigns
          </CardTitle>
          <Link href="/campaigns">
            <Button variant="ghost" size="sm" className="gap-1">
              View All
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="px-2">
          {campaigns.length > 0 ? (
            <div className="space-y-2">
              {campaigns.map((campaign, index) => (
                <div
                  key={campaign.campaign?.id || `campaign-${index}`}
                  className="rounded-md border p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-medium">
                      {campaign.campaign?.name || "Unnamed Campaign"}
                    </div>
                    <Badge
                      variant="outline"
                      className={getCampaignTypeColor(
                        campaign.campaign?.direction || "unknown",
                      )}
                    >
                      {campaign.campaign?.direction || "unknown"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Created{" "}
                      {campaign.campaign?.createdAt
                        ? formatDistance(
                            new Date(campaign.campaign.createdAt),
                            new Date(),
                            { addSuffix: true },
                          )
                        : "Unknown date"}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreateRun(campaign)}
                      className="h-7 gap-1 rounded-full px-2 text-xs"
                      disabled={!campaign.campaign?.id}
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      Create Run
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No campaigns yet
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCampaign && (
        <CreateRunAction
          type="modal"
          form={
            <RunCreateForm
              campaignId={selectedCampaign.campaign?.id}
              campaignBasePrompt={selectedCampaign.template.basePrompt}
              campaignVoicemailMessage={
                selectedCampaign.template.voicemailMessage
              }
              campaignName={selectedCampaign.campaign?.name}
              campaignDescription={selectedCampaign.template.description}
              campaignConfig={selectedCampaign.template.variablesConfig}
            />
          }
          title="Create Run"
          buttonText="Create Run"
        />
      )}
    </>
  );
}
