"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPhoneDisplay } from "@/lib/format-utils";
import { api } from "@/trpc/react";
import { format } from "date-fns";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Phone,
  Search,
  User,
  UserRoundX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";

interface PatientSearchProps {
  orgId: string;
  onPatientSelect?: (patient: any) => void;
  includeRecentCalls?: boolean;
}

export function PatientSearch({
  orgId,
  onPatientSelect,
  includeRecentCalls = false,
}: PatientSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    data: searchResults,
    isLoading,
    error,
    refetch,
  } = api.patient.searchPatients.useQuery(
    {
      orgId,
      query: debouncedQuery,
      includeRecentCalls,
      limit: 10,
    },
    {
      enabled: debouncedQuery.length >= 3 || /^\d{10,}$/.test(debouncedQuery),
      retry: false,
    },
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setIsSearching(true);
    },
    [],
  );

  const handlePatientSelect = useCallback(
    (patient: any) => {
      if (onPatientSelect) {
        onPatientSelect(patient);
      }
      setQuery("");
      setIsSearching(false);
    },
    [onPatientSelect],
  );

  const handleClearSearch = useCallback(() => {
    setQuery("");
    setIsSearching(false);
  }, []);

  // Focus the search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, phone, or ID..."
              className="pl-9 pr-9"
              value={query}
              onChange={handleSearchChange}
            />
            {query && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-2"
            onClick={() => refetch()}
            disabled={isLoading || !isSearching}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {isSearching && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium">
              Search Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoading ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex h-20 flex-col items-center justify-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {error.message || "Error fetching patients"}
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            ) : searchResults?.patients.length === 0 ? (
              <div className="flex h-20 flex-col items-center justify-center gap-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <UserRoundX className="h-5 w-5" />
                  <p className="text-sm">No patients found</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Implement new patient creation
                    if (onPatientSelect) {
                      onPatientSelect({
                        id: null,
                        isNew: true,
                        query: debouncedQuery,
                      });
                    }
                    setQuery("");
                    setIsSearching(false);
                  }}
                >
                  Create New Patient
                </Button>
              </div>
            ) : (
              <div className="space-y-1 py-1">
                {searchResults?.patients.map((patient: any, index: number) => (
                  <div
                    key={patient.id}
                    className="group flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-muted"
                    onClick={() => handlePatientSelect(patient)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-medium uppercase">
                        {patient.firstName?.[0] || ""}
                        {patient.lastName?.[0] || ""}
                      </div>
                      <div>
                        <div className="font-medium">
                          {patient.firstName} {patient.lastName}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {formatPhoneDisplay(patient.primaryPhone)}
                          </div>
                          {patient.dob && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(patient.dob), "MMM d, yyyy")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {patient.emrIdInOrg && (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1"
                        >
                          <User className="h-3 w-3" />
                          ID: {patient.emrIdInOrg}
                        </Badge>
                      )}
                      {includeRecentCalls &&
                        patient.recentCalls &&
                        patient.recentCalls.length > 0 && (
                          <Badge className="bg-blue-500" variant="default">
                            {patient.recentCalls.length} recent call
                            {patient.recentCalls.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      {patient.isPotentialDuplicate && (
                        <Badge variant="destructive">Potential Duplicate</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {searchResults &&
                  searchResults.total > searchResults.patients.length && (
                    <div className="py-2 text-center text-xs text-muted-foreground">
                      Showing {searchResults.patients.length} of{" "}
                      {searchResults.total} results. Refine your search to see
                      more.
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function PatientSearchInline({
  orgId,
  onPatientSelect,
}: PatientSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    data: searchResults,
    isLoading,
    error,
  } = api.patients.searchPatients.useQuery(
    {
      orgId,
      query: debouncedQuery,
      limit: 5,
    },
    {
      enabled: debouncedQuery.length >= 3 || /^\d{10,}$/.test(debouncedQuery),
    },
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const handlePatientSelect = useCallback(
    (patient: any) => {
      if (onPatientSelect) {
        onPatientSelect(patient);
      }
      setQuery("");
    },
    [onPatientSelect],
  );

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          type="text"
          placeholder="Search patients..."
          className="pl-9"
          value={query}
          onChange={handleSearchChange}
        />
      </div>

      {query &&
        (debouncedQuery.length >= 3 || /^\d{10,}$/.test(debouncedQuery)) && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
            {isLoading ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="p-2 text-center text-sm text-muted-foreground">
                {error.message || "Error searching patients"}
              </div>
            ) : searchResults?.patients.length === 0 ? (
              <div className="p-2 text-center text-sm text-muted-foreground">
                No patients found
              </div>
            ) : (
              <div className="py-1">
                {searchResults?.patients.map((patient: any) => (
                  <div
                    key={patient.id}
                    className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-muted"
                    onClick={() => handlePatientSelect(patient)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-medium uppercase">
                        {patient.firstName?.[0] || ""}
                        {patient.lastName?.[0] || ""}
                      </div>
                      <div>
                        <div className="font-medium">
                          {patient.firstName} {patient.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {patient.primaryPhone}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  );
}
