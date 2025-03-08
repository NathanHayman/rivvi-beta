"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { getPatients } from "@/server/actions/patients";
import { formatPhoneDisplay } from "@/services/out/file/utils";
import { PatientWithMetadata } from "@/types/api/patients";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// Define the patient type based on the database schema
type Patient = PatientWithMetadata;

export function PatientsTable() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const LIMIT = 20;
  const [patients, setPatients] = useState<Patient[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // Fetch patients using server action
  const fetchPatients = useCallback(async () => {
    try {
      setIsFetching(true);
      const data = await getPatients({
        limit: LIMIT,
        offset: page * LIMIT,
        search: search.length > 0 ? search : undefined,
      });

      setPatients((prev) =>
        page === 0 ? data.patients : [...prev, ...data.patients],
      );
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [page, search, LIMIT]);

  // Initial fetch and when dependencies change
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Load more handler
  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  // Define columns for the data table
  const columns: ColumnDef<Patient>[] = [
    {
      accessorKey: "name",
      header: "Patient",
      cell: ({ row }) => {
        const patient = row.original;
        const initials =
          `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`.toUpperCase();

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <div className="font-medium">
                <Link
                  href={`/patients/${patient.id}`}
                  className="hover:underline"
                >
                  {patient.firstName} {patient.lastName}
                </Link>
                {patient.isMinor && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Minor
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {patient.emrIdInOrg ? (
                  <span>ID: {patient.emrIdInOrg}</span>
                ) : (
                  <span>
                    DOB: {format(new Date(patient.dob), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "primaryPhone",
      header: "Phone",
      cell: ({ row }) => {
        const patient = row.original;
        const formattedPhone = formatPhoneDisplay(patient.primaryPhone);
        return formattedPhone;
      },
    },
    {
      accessorKey: "calls",
      header: "Calls",
      cell: ({ row }) => {
        const callCount = row.original.callCount || 0;
        return (
          <Badge variant={callCount > 0 ? "default" : "outline"}>
            {callCount} call{callCount !== 1 ? "s" : ""}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Added",
      cell: ({ row }) => {
        return (
          <span>{format(new Date(row.original.createdAt), "MMM d, yyyy")}</span>
        );
      },
      enableSorting: true,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <div className="flex justify-end">
            <Button asChild size="sm" variant="outline">
              <Link href={`/patients/${row.original.id}`}>View</Link>
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={patients}
      searchable
      onSearch={setSearch}
      isLoading={isLoading || isFetching}
      pagination={
        hasMore
          ? {
              hasNextPage: hasMore,
              onNextPage: handleLoadMore,
            }
          : undefined
      }
    />
  );
}
