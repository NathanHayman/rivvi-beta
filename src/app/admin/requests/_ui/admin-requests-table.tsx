"use client";

// src/components/admin/campaign-requests-table.tsx
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Check,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { processCampaignRequest } from "@/server/actions/campaigns/request";
import { TCampaignRequest } from "@/types/db";
import { formatDistance } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type CampaignRequestStatus =
  | "pending"
  | "approved"
  | "in_progress"
  | "rejected"
  | "completed";

type CampaignRequestWithRelations = TCampaignRequest & {
  organization: { name: string };
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
};

type AdminRequestsTableProps = {
  initialRequests: CampaignRequestWithRelations[];
  totalCount: number;
};

// Status badge component with appropriate colors
const StatusBadge = ({ status }: { status: CampaignRequestStatus }) => {
  switch (status) {
    case "pending":
      return (
        <Badge
          variant="outline"
          className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50"
        >
          Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 hover:bg-blue-50"
        >
          Approved
        </Badge>
      );
    case "in_progress":
      return (
        <Badge
          variant="outline"
          className="bg-purple-50 text-purple-700 hover:bg-purple-50"
        >
          In Progress
        </Badge>
      );
    case "completed":
      return (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 hover:bg-green-50"
        >
          Completed
        </Badge>
      );
    case "rejected":
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 hover:bg-red-50"
        >
          Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export function AdminRequestsTable({
  initialRequests,
  totalCount,
}: AdminRequestsTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "approved" | "in_progress" | "rejected" | "completed" | "all"
  >("pending");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [adminNotes, setAdminNotes] = useState("");
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<TCampaignRequest | null>(null);

  // State for filtered data
  const [requests, setRequests] =
    useState<CampaignRequestWithRelations[]>(initialRequests);
  const [filteredTotalCount, setFilteredTotalCount] = useState(totalCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Initial data fetch on mount
  useEffect(() => {
    // No need to fetch data on mount as we're using initialData from props
  }, []);

  // Filter data client-side when statusFilter changes
  useEffect(() => {
    if (statusFilter === "all") {
      setRequests(initialRequests);
      setFilteredTotalCount(totalCount);
      return;
    }

    const filtered = initialRequests.filter(
      (request) => request.status === statusFilter,
    );
    setRequests(filtered);
    setFilteredTotalCount(filtered.length);
  }, [statusFilter, initialRequests, totalCount]);

  // Process request functions using server actions
  const approveRequest = async () => {
    if (!selectedRequestId) return;

    setIsApproving(true);
    try {
      await processCampaignRequest({
        requestId: selectedRequestId,
        status: "approved",
        adminNotes: adminNotes || undefined,
      });

      toast.success("Request approved successfully");
      setIsApproveDialogOpen(false);
      router.refresh(); // Refresh the page to get updated data from server
    } catch (error) {
      toast.error(
        `Error approving request: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsApproving(false);
    }
  };

  const rejectRequest = async () => {
    if (!selectedRequestId) return;

    setIsRejecting(true);
    try {
      await processCampaignRequest({
        requestId: selectedRequestId,
        status: "rejected",
        adminNotes: adminNotes || undefined,
      });

      toast.success("Request rejected successfully");
      setIsRejectDialogOpen(false);
      router.refresh(); // Refresh the page to get updated data from server
    } catch (error) {
      toast.error(
        `Error rejecting request: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsRejecting(false);
    }
  };

  // Handlers
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(
      value as
        | "pending"
        | "approved"
        | "in_progress"
        | "rejected"
        | "completed"
        | "all",
    );
    setPagination({ ...pagination, pageIndex: 0 });
  };

  const handleApproveRequest = (requestId: string) => {
    setSelectedRequestId(requestId);
    setAdminNotes("");
    setIsApproveDialogOpen(true);
  };

  const handleRejectRequest = (requestId: string) => {
    setSelectedRequestId(requestId);
    setAdminNotes("");
    setIsRejectDialogOpen(true);
  };

  const confirmApprove = () => {
    void approveRequest();
  };

  const confirmReject = () => {
    void rejectRequest();
  };

  const handleCreateCampaign = (requestId: string, orgId: string) => {
    // First change status to in_progress to indicate campaign creation has started
    processCampaignRequest({
      requestId,
      status: "in_progress",
      adminNotes: "Campaign creation in progress",
    })
      .then(() => {
        router.push(`/admin/campaigns/new?requestId=${requestId}`);
      })
      .catch((error) => {
        console.error("Error processing campaign request:", error);
        toast.error("Failed to process campaign request");
      });
  };

  const handleViewDetails = (request: TCampaignRequest) => {
    setSelectedRequest(request);
    setIsViewDetailsOpen(true);
  };

  // Define columns
  const columns: ColumnDef<CampaignRequestWithRelations>[] = [
    {
      accessorKey: "organization.name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Organization
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.organization?.name || "Unknown Organization"}
        </div>
      ),
    },
    {
      accessorKey: "name",
      header: "Campaign Name",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.getValue("name")}</div>
          <div className="text-xs text-muted-foreground">
            Direction: {row.original.direction}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const description = row.original.description;
        return (
          <div className="max-w-xs">
            <div className="line-clamp-2 text-sm">
              {description.length > 100
                ? `${description.substring(0, 100)}...`
                : description}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "user",
      header: "Requested By",
      cell: ({ row }) => {
        const user = row.original.user;
        return (
          <div>
            {user ? (
              <>
                <div>
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {user.email}
                </div>
              </>
            ) : (
              <span className="text-muted-foreground">Unknown</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Requested
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-sm">
          {formatDistance(new Date(row.original.createdAt), new Date(), {
            addSuffix: true,
          })}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as CampaignRequestStatus;
        return <StatusBadge status={status} />;
      },
      filterFn: (row, id, value) => {
        return value === "all" || row.getValue(id) === value;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const request = row.original;
        const status = request.status;

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleViewDetails(request)}>
                  View Details
                </DropdownMenuItem>

                {status === "pending" && (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleApproveRequest(request.id)}
                      className="cursor-pointer"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleRejectRequest(request.id)}
                      className="cursor-pointer"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Reject
                    </DropdownMenuItem>
                  </>
                )}

                {status === "approved" && (
                  <DropdownMenuItem
                    onClick={() =>
                      handleCreateCampaign(request.id, request.orgId)
                    }
                    className="cursor-pointer"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Campaign
                  </DropdownMenuItem>
                )}

                {status === "in_progress" && request.resultingCampaignId && (
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(
                        `/admin/campaigns/${request.resultingCampaignId}`,
                      )
                    }
                    className="cursor-pointer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Campaign
                  </DropdownMenuItem>
                )}

                {status === "in_progress" && !request.resultingCampaignId && (
                  <DropdownMenuItem
                    onClick={() =>
                      handleCreateCampaign(request.id, request.orgId)
                    }
                    className="cursor-pointer"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resume Campaign Creation
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  // Create table
  const table = useReactTable({
    data: requests,
    columns: columns as any,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: {
      pagination,
      sorting,
    },
    manualPagination: true,
    pageCount: Math.ceil(filteredTotalCount / pagination.pageSize),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 lg:px-3"
            onClick={() => router.refresh()}
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="r">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading requests...
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No campaign requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {filteredTotalCount}{" "}
          requests
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <div className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Campaign Request Details Sheet */}
      <Sheet open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Campaign Request Details</SheetTitle>
            <SheetDescription>
              Review the details of this campaign request
            </SheetDescription>
          </SheetHeader>

          {selectedRequest && (
            <div className="h-[calc(87vh-100px)]">
              <SheetBody className="mt-6 h-full space-y-6">
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
                      {selectedRequest.status.charAt(0).toUpperCase() +
                        selectedRequest.status.slice(1)}
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
                    Requested By
                  </h3>
                  <p className="text-sm">
                    {selectedRequest.requestedBy ?? "Unknown"}
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Requested On
                  </h3>
                  <p className="text-sm">
                    {new Date(selectedRequest.createdAt).toLocaleString()}
                  </p>
                </div>
              </SheetBody>

              <SheetFooter>
                {selectedRequest.status === "pending" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsViewDetailsOpen(false);
                        handleRejectRequest(selectedRequest.id);
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      onClick={() => {
                        setIsViewDetailsOpen(false);
                        handleApproveRequest(selectedRequest.id);
                      }}
                    >
                      Approve
                    </Button>
                  </>
                )}

                {selectedRequest.status === "approved" &&
                  !selectedRequest.resultingCampaignId && (
                    <Button
                      onClick={() => {
                        setIsViewDetailsOpen(false);
                        handleCreateCampaign(
                          selectedRequest.id,
                          selectedRequest.orgId,
                        );
                      }}
                    >
                      Create Campaign
                    </Button>
                  )}

                {selectedRequest.resultingCampaignId && (
                  <Button
                    onClick={() => {
                      router.push(
                        `/admin/campaigns/${selectedRequest.resultingCampaignId}`,
                      );
                    }}
                  >
                    View Campaign
                  </Button>
                )}
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Campaign Request</DialogTitle>
            <DialogDescription>
              Approving this request indicates it has been reviewed and
              accepted. You&apos;ll need to create the campaign separately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-4 lg:p-6">
            <div className="space-y-2">
              <label
                htmlFor="admin-notes"
                className="text-sm font-medium leading-none"
              >
                Admin Notes (Optional)
              </label>
              <Textarea
                id="admin-notes"
                placeholder="Add any notes about this approval..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveDialogOpen(false)}
              disabled={isApproving}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApprove}
              disabled={isApproving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isApproving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                "Approve Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Campaign Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this campaign request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="reject-reason"
                className="text-sm font-medium leading-none"
              >
                Rejection Reason
              </label>
              <Textarea
                id="reject-reason"
                placeholder="Explain why this request is being rejected..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmReject}
              disabled={isRejecting || !adminNotes.trim()}
              variant="destructive"
            >
              {isRejecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
