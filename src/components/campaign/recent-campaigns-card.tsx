"use client";

// src/components/dashboard/recent-campaigns-card.tsx
import { formatDistance } from "date-fns";
import { ArrowUpRight, CalendarIcon } from "lucide-react";
import Link from "next/link";

import { CreateRunModal } from "@/components/run/create-run-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

interface Campaign {
  id: string;
  name: string;
  type: string;
  createdAt: Date;
}

interface RecentCampaignsCardProps {
  campaigns: Campaign[];
}

export function RecentCampaignsCard({ campaigns }: RecentCampaignsCardProps) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  );
  const [isCreateRunModalOpen, setIsCreateRunModalOpen] = useState(false);

  const handleCreateRun = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setIsCreateRunModalOpen(true);
  };

  const getCampaignTypeColor = (type: string) => {
    switch (type) {
      case "appointment_confirmation":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "annual_wellness":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "medication_adherence":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      case "no_show_followup":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
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
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-medium">{campaign.name}</div>
                    <Badge
                      variant="outline"
                      className={getCampaignTypeColor(campaign.type)}
                    >
                      {campaign.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Created{" "}
                      {formatDistance(
                        new Date(campaign.createdAt),
                        new Date(),
                        { addSuffix: true },
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreateRun(campaign.id)}
                      className="h-7 gap-1 rounded-full px-2 text-xs"
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

      {selectedCampaignId && (
        <CreateRunModal
          campaignId={selectedCampaignId}
          open={isCreateRunModalOpen}
          onOpenChange={setIsCreateRunModalOpen}
        />
      )}
    </>
  );
}
