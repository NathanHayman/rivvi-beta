"use client";

// src/components/dashboard/recent-calls-card.tsx
import { formatDistance } from "date-fns";
import {
  ArrowUpRight,
  CheckCircle,
  CircleAlert,
  Clock,
  PhoneOutgoing,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Call {
  id: string;
  createdAt: Date;
  status: string;
  direction: "inbound" | "outbound";
  patient?: {
    firstName: string;
    lastName: string;
  } | null;
}

interface RecentCallsCardProps {
  calls: Call[];
}

export function RecentCallsCard({ calls }: RecentCallsCardProps) {
  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Recent Calls</CardTitle>
        <Link href="/calls">
          <Button variant="ghost" size="sm" className="gap-1">
            View All
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="px-2">
        {calls.length > 0 ? (
          <div className="space-y-2">
            {calls.map((call) => {
              // Determine call status icon
              let StatusIcon = PhoneOutgoing;
              let statusColor = "text-blue-500";

              if (call.status === "completed") {
                StatusIcon = CheckCircle;
                statusColor = "text-green-500";
              } else if (call.status === "failed") {
                StatusIcon = CircleAlert;
                statusColor = "text-red-500";
              } else if (call.status === "in-progress") {
                StatusIcon = Clock;
                statusColor = "text-amber-500";
              }

              return (
                <Link key={call.id} href={`/calls?callId=${call.id}`}>
                  <div className="flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-muted">
                    <div className="flex items-center gap-3">
                      <div className={statusColor}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {call.patient?.firstName}{" "}
                          {call.patient?.lastName || "Unknown Patient"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistance(
                            new Date(call.createdAt),
                            new Date(),
                            {
                              addSuffix: true,
                            },
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={
                        call.status === "completed"
                          ? "success_solid"
                          : call.status === "failed"
                            ? "failure_solid"
                            : "neutral_solid"
                      }
                    >
                      {call.status}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No recent calls
          </div>
        )}
      </CardContent>
    </Card>
  );
}
