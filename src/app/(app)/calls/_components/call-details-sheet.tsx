"use client";

import { AudioPlayerWithWaveform } from "@/components/ui/audio-wave-player";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TCall } from "@/types/db";
import { format } from "date-fns";
import {
  Bot,
  Check,
  CircleAlert,
  Clock,
  ExternalLink,
  FileText,
  Info,
  Mic,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PieChart,
  User,
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

type CallDetails = TCall & {
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
  transcript?: string;
  recordingUrl?: string;
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
      <SheetContent
        className="w-full p-0 sm:max-w-md md:max-w-xl lg:max-w-2xl"
        side="right"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="">Call Details</SheetTitle>
            </div>
          </SheetHeader>

          <CallDetailsContent callId={callId} />
        </div>
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
      <div className="flex h-full flex-col items-center justify-center p-6">
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

  // Determine if we should override the status
  const hasAnalysisData =
    call.analysis && Object.keys(call.analysis).length > 0;
  const displayStatus =
    call.status === "in-progress" && hasAnalysisData
      ? ("completed" as CallStatus)
      : call.status;

  // Determine status icon and color
  let StatusIcon = Clock;
  let badgeVariant = "neutral_solid" as
    | "neutral_solid"
    | "success_solid"
    | "failure_solid";

  if (displayStatus === "completed") {
    StatusIcon = Check;
    badgeVariant = "success_solid";
  } else if (displayStatus === "failed" || displayStatus === "no-answer") {
    StatusIcon = CircleAlert;
    badgeVariant = "failure_solid";
  } else if (displayStatus === "in-progress") {
    StatusIcon = PhoneCall;
    badgeVariant = "neutral_solid";
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

  // Extract summary from analysis if available
  const summary = call.analysis?.summary || "";

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      <SheetBody className="overflow-auto border-b lg:pb-8">
        {/* Top section with basic info */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {call.direction === "inbound" ? (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100">
                  <PhoneIncoming className="h-4 w-4 text-yellow-600" />
                </div>
                <span className="font-medium">Inbound Call</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100">
                  <PhoneOutgoing className="h-4 w-4 text-violet-600" />
                </div>
                <span className="font-medium">Outbound Call</span>
              </div>
            )}
          </div>
          <Badge
            variant={badgeVariant}
            className="flex items-center gap-1.5 px-2.5 py-1"
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {formatStatus(displayStatus)}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">From</p>
            <p className="font-medium">{formatPhoneNumber(call.fromNumber)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">To</p>
            <p className="font-medium">{formatPhoneNumber(call.toNumber)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Start Time
            </p>
            <p className="font-medium">
              {call.startTime
                ? format(new Date(call.startTime), "MMM d, yyyy h:mm a")
                : "Not started"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              End Time
            </p>
            <p className="font-medium">
              {call.endTime
                ? format(new Date(call.endTime), "MMM d, yyyy h:mm a")
                : "Not ended"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Duration
            </p>
            <p className="font-medium">{formatDuration(call.duration)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Created</p>
            <p className="font-medium">
              {format(new Date(call.createdAt), "MMM d, yyyy h:mm a")}
            </p>
          </div>
        </div>

        {/* Patient information */}
        {call.patient && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium">Patient Information</h3>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {`${call.patient.firstName?.[0] || ""}${call.patient.lastName?.[0] || ""}`.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{`${call.patient.firstName} ${call.patient.lastName}`}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPhoneNumber(call.patient.primaryPhone || "")}
                  </p>
                </div>
              </div>
              {call.patient.id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  asChild
                >
                  <a
                    href={`/patients/${call.patient.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Profile
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Campaign information */}
        {call.campaign && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium">Campaign</h3>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <p className="font-medium">{call.campaign.name}</p>
              {call.campaign.id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  asChild
                >
                  <a
                    href={`/campaigns/${call.campaign.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Campaign
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Call summary */}
        {summary && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium">Summary</h3>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm">{summary}</p>
            </div>
          </div>
        )}

        {/* Call recording preview
        {call.recordingUrl && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium">Recording</h3>
            <div className="rounded-lg border bg-muted/30 p-3">
              <AudioPlayerWithWaveform
                audioUrl={call.recordingUrl}
                onDownload={() => {}}
              />
            </div>
          </div>
        )} */}
      </SheetBody>

      {/* Tabs section */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Tabs defaultValue="analysis" className="flex h-full flex-col">
          <div className="border-b bg-accent/50 px-6">
            <TabsList className="h-12 w-full justify-start gap-4 rounded-none bg-transparent p-0">
              <TabsTrigger
                value="analysis"
                className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary"
              >
                <PieChart className="h-4 w-4" />
                Analysis
              </TabsTrigger>
              <TabsTrigger
                value="recording"
                className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary"
              >
                <Mic className="h-4 w-4" />
                Recording
              </TabsTrigger>
              <TabsTrigger
                value="transcript"
                className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary"
              >
                <FileText className="h-4 w-4" />
                Transcript
              </TabsTrigger>
              <TabsTrigger
                value="details"
                className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary"
              >
                <Info className="h-4 w-4" />
                Details
              </TabsTrigger>
            </TabsList>
          </div>
          <ScrollArea className="relative flex-1 -scroll-m-8 scroll-pb-9">
            <div className="relative max-h-[calc(40vh-250px)] flex-1">
              {/* Analysis Tab */}
              <TabsContent
                value="analysis"
                className="h-full p-0 data-[state=active]:block"
              >
                <div className="p-6">
                  {call.analysis && Object.keys(call.analysis).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(call.analysis)
                        .filter(([key]) => key !== "summary") // Skip summary as it's shown above
                        .map(([key, value]) => (
                          <div key={key} className="rounded-lg border p-3">
                            <h4 className="mb-1 text-sm font-medium capitalize">
                              {key
                                .replace(/([A-Z])/g, " $1")
                                .replace(/_/g, " ")}
                            </h4>
                            <div className="text-sm">
                              {typeof value === "boolean" ? (
                                value ? (
                                  <Badge variant="success_solid">Yes</Badge>
                                ) : (
                                  <Badge variant="failure_solid">No</Badge>
                                )
                              ) : typeof value === "object" ? (
                                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              ) : (
                                String(value)
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center text-center">
                      <CircleAlert className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No analysis data available for this call
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Recording Tab */}
              <TabsContent
                value="recording"
                className="h-full p-0 data-[state=active]:block"
              >
                <div className="p-6">
                  {call.recordingUrl ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border p-4">
                        <AudioPlayerWithWaveform
                          audioUrl={call.recordingUrl}
                          onDownload={() => {}}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (call.recordingUrl) {
                              window.open(call.recordingUrl, "_blank");
                            }
                          }}
                        >
                          Download Recording
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center text-center">
                      <Mic className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No recording available for this call
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Transcript Tab */}
              <TabsContent
                value="transcript"
                className="h-full p-0 data-[state=active]:block"
              >
                <div className="p-6">
                  {call.transcript ? (
                    <CallTranscript transcript={call.transcript} />
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center text-center">
                      <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No transcript available for this call
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Details Tab */}
              <TabsContent
                value="details"
                className="h-full p-0 data-[state=active]:block"
              >
                <div className="space-y-4 p-6">
                  {/* Call details */}
                  <div className="rounded-lg border">
                    <div className="border-b bg-muted/30 px-4 py-2">
                      <h3 className="font-medium">Call Details</h3>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-y-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            Call ID
                          </p>
                          <p className="font-mono text-xs">{call.id}</p>
                        </div>
                        {call.run && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              Run ID
                            </p>
                            <p className="font-mono text-xs">{call.run.id}</p>
                          </div>
                        )}
                        {call.row && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              Row ID
                            </p>
                            <p className="font-mono text-xs">{call.row.id}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Additional metadata */}
                  {call.metadata && (
                    <div className="rounded-lg border">
                      <div className="border-b bg-muted/30 px-4 py-2">
                        <h3 className="font-medium">Metadata</h3>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-y-3">
                          {Object.entries(call.metadata)
                            .filter(
                              ([key]) =>
                                !["summary", "notes", "userSentiment"].includes(
                                  key,
                                ),
                            )
                            .map(([key, value]) => (
                              <div key={key} className="">
                                <p className="text-xs font-medium capitalize text-muted-foreground">
                                  {key
                                    .replace(/([A-Z])/g, " $1")
                                    .replace(/_/g, " ")}
                                </p>
                                <p className="max-w-64 truncate text-sm">
                                  {typeof value === "boolean"
                                    ? value
                                      ? "Yes"
                                      : "No"
                                    : typeof value === "object"
                                      ? JSON.stringify(value)
                                      : String(value)}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}

function CallDetailsSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-24" />
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-1 h-3 w-16" />
                <Skeleton className="h-5 w-32" />
              </div>
            ))}
        </div>

        <div className="mt-6">
          <Skeleton className="mb-3 h-4 w-32" />
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="mb-1 h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="border-b px-6">
          <div className="flex h-12 gap-4">
            {["Analysis", "Recording", "Transcript", "Details"].map(
              (tab, i) => (
                <Skeleton key={i} className="h-8 w-24" />
              ),
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CallTranscript({ transcript }: { transcript: string }) {
  // this has `Agent:`, `User:`, `Agent:`, `User:`, etc.
  // I want to split it into an array of objects with `role` and `content`
  const lines = transcript.split("\n");
  const transcriptArray = lines.map((line) => {
    if (line.startsWith("Agent: ")) {
      return { role: "Agent", content: line.slice(7) };
    } else if (line.startsWith("User: ")) {
      return { role: "User", content: line.slice(6) };
    }
    return { role: "", content: "" };
  });

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-6 px-4">
      {transcriptArray.map(({ role, content }, index) => {
        if (role === "Agent") {
          return (
            <div
              key={role + content + index}
              className="flex items-start gap-2"
            >
              <div className="flex items-start gap-2">
                <div className="flex h-7 w-20 items-center justify-center gap-1 rounded-lg bg-violet-100 text-violet-600">
                  <Bot className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Agent
                  </span>
                </div>
                <div className="rounded-lg border bg-background p-2">
                  <p className="text-sm">{content}</p>
                </div>
              </div>
            </div>
          );
        } else if (role === "User") {
          return (
            <div key={role + content + index}>
              <div className="flex items-start justify-end gap-2">
                <div className="rounded-lg border bg-background p-2">
                  <p className="text-sm">{content}</p>
                </div>
                <div className="flex h-7 w-24 items-center justify-center gap-1 rounded-lg bg-blue-100 text-blue-600">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Patient
                  </span>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
