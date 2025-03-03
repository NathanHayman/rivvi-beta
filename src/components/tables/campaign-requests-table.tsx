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
  Filter,
  Loader2,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { TCampaignRequest } from "@/types/db";
import { formatDistance } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type CampaignRequestStatus = "pending" | "approved" | "rejected" | "completed";

// interface CampaignRequest {
//   id: string;
//   orgId: string;
//   requestedBy: string | null;
//   name: string;
//   type: string;
//   description: string;
//   status: CampaignRequestStatus;
//   adminNotes: string | null;
//   resultingCampaignId: string | null;
//   createdAt: Date;
//   updatedAt: Date;
//   organization?: {
//     name: string;
//   };
//   user?: {
//     firstName: string | null;
//     lastName: string | null;
//     email: string;
//   };
// }

export function CampaignRequestsTable() {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [statusFilter, setStatusFilter] = useState<
    CampaignRequestStatus | "all"
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

  // Get campaign requests data
  const { data, isLoading, refetch } =
    api.admin.getAllCampaignRequests.useQuery({
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    });

  // Process request mutations
  const approveRequestMutation = api.admin.processCampaignRequest.useMutation({
    onSuccess: () => {
      toast.success("Request approved successfully");
      setIsApproveDialogOpen(false);
      void refetch();
    },
    onError: (error) => {
      toast.error(`Error approving request: ${error.message}`);
    },
  });

  const rejectRequestMutation = api.admin.processCampaignRequest.useMutation({
    onSuccess: () => {
      toast.success("Request rejected successfully");
      setIsRejectDialogOpen(false);
      void refetch();
    },
    onError: (error) => {
      toast.error(`Error rejecting request: ${error.message}`);
    },
  });

  // Handlers
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as CampaignRequestStatus | "all");
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
    if (!selectedRequestId) return;

    approveRequestMutation.mutate({
      requestId: selectedRequestId,
      status: "approved",
      adminNotes: adminNotes || undefined,
    });
  };

  const confirmReject = () => {
    if (!selectedRequestId) return;

    rejectRequestMutation.mutate({
      requestId: selectedRequestId,
      status: "rejected",
      adminNotes: adminNotes || undefined,
    });
  };

  const handleCreateCampaign = (requestId: string, orgId: string) => {
    router.push(`/admin/campaigns/new?requestId=${requestId}&orgId=${orgId}`);
  };

  // Define columns
  const columns: ColumnDef<
    TCampaignRequest & {
      organization: { name: string };
      user: {
        firstName: string | null;
        lastName: string | null;
        email: string;
      };
    }
  >[] = [
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
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as CampaignRequestStatus;

        const statusConfig = {
          pending: {
            label: "Pending",
            variant: "neutral_solid" as const,
            icon: <Clock className="mr-1.5 h-3.5 w-3.5" />,
          },
          approved: {
            label: "Approved",
            variant: "success_solid" as const,
            icon: <Check className="mr-1.5 h-3.5 w-3.5" />,
          },
          rejected: {
            label: "Rejected",
            variant: "failure_solid" as const,
            icon: <X className="mr-1.5 h-3.5 w-3.5" />,
          },
          completed: {
            label: "Completed",
            variant: "neutral_solid" as const,
            icon: <Check className="mr-1.5 h-3.5 w-3.5" />,
          },
        };

        const { label, variant, icon } = statusConfig[status];

        return (
          <Badge variant={variant as any} className="flex w-fit items-center">
            {icon}
            {label}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const request = row.original;
        const isApproved = request.status === "approved";
        const isPending = request.status === "pending";

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
                <DropdownMenuItem
                  onClick={() => {
                    // Open a dialog to view details
                    // This would be implemented in a real app
                    alert("View request details: " + request.description);
                  }}
                >
                  View Details
                </DropdownMenuItem>

                {isPending && (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleApproveRequest(request.id)}
                    >
                      Approve Request
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleRejectRequest(request.id)}
                    >
                      Reject Request
                    </DropdownMenuItem>
                  </>
                )}

                {isApproved && (
                  <DropdownMenuItem
                    onClick={() =>
                      handleCreateCampaign(request.id, request.orgId)
                    }
                  >
                    Create Campaign
                  </DropdownMenuItem>
                )}

                {request.resultingCampaignId && (
                  <DropdownMenuItem
                    onClick={() => {
                      router.push(
                        `/admin/campaigns/${request.resultingCampaignId}`,
                      );
                    }}
                  >
                    View Campaign
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
    data: data?.requests || [],
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
    pageCount: data ? Math.ceil(data.totalCount / pagination.pageSize) : 0,
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
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
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
          Showing {table.getRowModel().rows.length} of {data?.totalCount || 0}{" "}
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

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Campaign Request</DialogTitle>
            <DialogDescription>
              Approving this request indicates it has been reviewed and
              accepted. You'll need to create the campaign separately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
              disabled={approveRequestMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApprove}
              disabled={approveRequestMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveRequestMutation.isPending ? (
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
              disabled={rejectRequestMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmReject}
              disabled={rejectRequestMutation.isPending || !adminNotes.trim()}
              variant="destructive"
            >
              {rejectRequestMutation.isPending ? (
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
