"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { format } from "date-fns";
import {
  CheckCircle,
  CircleAlert,
  Clock,
  ExternalLink,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Define the call type based on the API response
type CallStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "failed"
  | "voicemail"
  | "no-answer";

type CallDirection = "inbound" | "outbound";

type CallDetails = {
  id: string;
  status: CallStatus;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  startTime: string | Date | null;
  endTime: string | Date | null;
  duration: number | null;
  createdAt: string | Date;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    primaryPhone?: string;
  } | null;
  campaign?: {
    id: string;
    name: string;
  } | null;
  analysis?: Record<string, any>;
  run?: any;
  row?: any;
};

export function CallDetailsSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const callId = searchParams.get("callId");

  // Close the sheet and return to the calls list
  const handleClose = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("callId");
    router.push(`${pathname}?${params.toString()}`);
  };

  // If no callId, don't render anything
  if (!callId) return null;

  return (
    <Sheet open={!!callId} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg" side="right">
        <SheetHeader className="mb-4 flex flex-row items-center justify-between pr-4">
          <div>
            <SheetTitle>Call Details</SheetTitle>
            <SheetDescription>
              Detailed information about this call
            </SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>

        <CallDetailsContent callId={callId} />
      </SheetContent>
    </Sheet>
  );
}

function CallDetailsContent({ callId }: { callId: string }) {
  const { data, isLoading, error } = api.calls.getById.useQuery({ id: callId });

  if (isLoading) {
    return <CallDetailsSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <CircleAlert className="mb-4 h-12 w-12 text-red-500" />
        <h3 className="text-xl font-semibold">Error loading call</h3>
        <p className="text-muted-foreground">
          {error?.message || "Call could not be found"}
        </p>
      </div>
    );
  }

  // Cast the data to our CallDetails type
  const call = data as unknown as CallDetails;

  // Determine status icon and color
  let StatusIcon = Clock;
  let statusColor = "text-zinc-500";
  let badgeVariant = "neutral_solid" as
    | "neutral_solid"
    | "success_solid"
    | "failure_solid";

  if (call.status === "completed") {
    StatusIcon = CheckCircle;
    statusColor = "text-green-500";
    badgeVariant = "success_solid";
  } else if (call.status === "failed" || call.status === "no-answer") {
    StatusIcon = CircleAlert;
    statusColor = "text-red-500";
    badgeVariant = "failure_solid";
  } else if (call.status === "in-progress") {
    StatusIcon = PhoneCall;
    statusColor = "text-amber-500";
  }

  const formatStatus = (status: string) => {
    return status === "in-progress"
      ? "In Progress"
      : status === "no-answer"
        ? "No Answer"
        : status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Calculate duration in readable format
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
      return `${remainingSeconds}s`;
    }

    return `${minutes}m ${remainingSeconds}s`;
  };

  // Format phone number
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return "N/A";

    // Basic formatting for US numbers - adjust as needed
    if (phone.length === 10) {
      return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
    }

    if (phone.length === 11 && phone.startsWith("1")) {
      return `+1 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`;
    }

    return phone;
  };

  return (
    <div
      className="space-y-6 overflow-y-auto pr-1"
      style={{ maxHeight: "calc(100vh - 120px)" }}
    >
      {/* Call overview card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Call Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {call.direction === "inbound" ? (
                <>
                  <PhoneIncoming className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">Inbound Call</span>
                </>
              ) : (
                <>
                  <PhoneOutgoing className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Outbound Call</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon className={`h-5 w-5 ${statusColor}`} />
              <Badge variant={badgeVariant}>{formatStatus(call.status)}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-sm text-muted-foreground">From</p>
              <p className="font-medium">
                {formatPhoneNumber(call.fromNumber)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">To</p>
              <p className="font-medium">{formatPhoneNumber(call.toNumber)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Start Time</p>
              <p className="font-medium">
                {call.startTime
                  ? format(new Date(call.startTime), "MMM d, yyyy h:mm a")
                  : "Not started"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">End Time</p>
              <p className="font-medium">
                {call.endTime
                  ? format(new Date(call.endTime), "MMM d, yyyy h:mm a")
                  : "Not ended"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-medium">{formatDuration(call.duration)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">
                {format(new Date(call.createdAt), "MMM d, yyyy h:mm a")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient information */}
      {call.patient && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Patient Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {`${call.patient.firstName?.[0] || ""}${call.patient.lastName?.[0] || ""}`.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{`${call.patient.firstName} ${call.patient.lastName}`}</p>
                <p className="text-sm text-muted-foreground">
                  {call.patient.primaryPhone || "No phone number"}
                </p>
              </div>
            </div>

            {call.patient.id && (
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a
                  href={`/patients/${call.patient.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Patient Profile
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Campaign information */}
      {call.campaign && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{call.campaign.name}</p>

            {call.campaign.id && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                asChild
              >
                <a
                  href={`/campaigns/${call.campaign.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Campaign
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Call analysis/outcome */}
      {call.analysis && Object.keys(call.analysis).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Call Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(call.analysis).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-2">
                  <div className="text-sm font-medium capitalize">
                    {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                  </div>
                  <div className="text-sm">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CallDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Call Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-24" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            {Array(6)
              .fill(0)
              .map((_, i) => (
                <div key={i}>
                  <Skeleton className="mb-2 h-4 w-16" />
                  <Skeleton className="h-5 w-32" />
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Patient Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="mb-1 h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>

          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
