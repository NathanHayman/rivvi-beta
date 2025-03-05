"use client";

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/trpc/react";
import { formatDistance } from "date-fns";
import { Check, Clock, ExternalLink, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function OrganizationCampaignRequestsTable() {
  const router = useRouter();
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  // Get campaign requests data for the current user's organization
  const { data, isLoading, refetch } =
    api.campaigns.getCampaignRequests.useQuery({
      limit: 100,
      offset: 0,
    });

  // Handle viewing request details
  const handleViewDetails = (request: any) => {
    setSelectedRequest(request);
    setIsViewDetailsOpen(true);
  };

  // If there are no requests, show a message
  if (!isLoading && (!data?.requests || data.requests.length === 0)) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>No Campaign Requests</CardTitle>
          <CardDescription>
            You haven't requested any campaigns yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Request a new campaign to get started with Rivvi's voice AI
            capabilities.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            onClick={() => router.push("/campaigns/request")}
            className="w-full"
          >
            Request a Campaign
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div className="font-medium">{request.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {request.description?.length > 60
                      ? `${request.description.substring(0, 60)}...`
                      : request.description}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      request.status === "pending"
                        ? "neutral_solid"
                        : request.status === "approved"
                          ? "success_solid"
                          : request.status === "rejected"
                            ? "failure_solid"
                            : "neutral_solid"
                    }
                    className="flex w-fit items-center"
                  >
                    {request.status === "pending" && (
                      <Clock className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {request.status === "approved" && (
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {request.status === "rejected" && (
                      <X className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {request.status?.charAt(0).toUpperCase() +
                      request.status?.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatDistance(new Date(request.createdAt), new Date(), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(request)}
                    >
                      View Details
                    </Button>
                    {request.resultingCampaignId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/campaigns/${request.resultingCampaignId}`,
                          )
                        }
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        View Campaign
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Campaign Request Details Sheet */}
      <Sheet open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Campaign Request Details</SheetTitle>
            <SheetDescription>
              Review the details of your campaign request
            </SheetDescription>
          </SheetHeader>

          {selectedRequest && (
            <div className="mt-6 space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Status
                </h3>
                <div>
                  <Badge
                    variant={
                      selectedRequest.status === "pending"
                        ? "neutral_solid"
                        : selectedRequest.status === "approved"
                          ? "success_solid"
                          : selectedRequest.status === "rejected"
                            ? "failure_solid"
                            : "neutral_solid"
                    }
                    className="flex w-fit items-center"
                  >
                    {selectedRequest.status === "pending" && (
                      <Clock className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {selectedRequest.status === "approved" && (
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {selectedRequest.status === "rejected" && (
                      <X className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {selectedRequest.status?.charAt(0).toUpperCase() +
                      selectedRequest.status?.slice(1)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Campaign Name
                </h3>
                <p className="text-base">{selectedRequest.name}</p>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Description
                </h3>
                <p className="whitespace-pre-wrap text-sm">
                  {selectedRequest.description}
                </p>
              </div>

              {selectedRequest.mainGoal && (
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Main Goal
                  </h3>
                  <p className="whitespace-pre-wrap text-sm">
                    {selectedRequest.mainGoal}
                  </p>
                </div>
              )}

              {selectedRequest.desiredAnalysis &&
                selectedRequest.desiredAnalysis.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Desired Analysis/KPIs
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedRequest.desiredAnalysis.map((kpi, index) => (
                        <Badge key={index} variant="secondary">
                          {kpi}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {selectedRequest.exampleSheets &&
                selectedRequest.exampleSheets.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Example Sheets
                    </h3>
                    <div className="space-y-2">
                      {selectedRequest.exampleSheets.map((sheet, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-md border border-border bg-background p-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium">
                              {sheet.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ({sheet.fileType})
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(sheet.url, "_blank")}
                          >
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {selectedRequest.adminNotes && (
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Admin Notes
                  </h3>
                  <p className="whitespace-pre-wrap text-sm">
                    {selectedRequest.adminNotes}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Requested On
                </h3>
                <p className="text-sm">
                  {new Date(selectedRequest.createdAt).toLocaleString()}
                </p>
              </div>

              {selectedRequest.resultingCampaignId && (
                <div className="mt-8 flex justify-end">
                  <Button
                    onClick={() => {
                      router.push(
                        `/campaigns/${selectedRequest.resultingCampaignId}`,
                      );
                    }}
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    View Campaign
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
