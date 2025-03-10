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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPatient } from "@/server/actions/patients";
import {
  calculateAge,
  formatPhoneDisplay,
} from "@/services/outdated/file/utils";
import { PatientWithMetadata } from "@/types/api/patients";
import { format } from "date-fns";
import {
  CalendarIcon,
  ChevronRightIcon,
  ClipboardIcon,
  PhoneIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { CallHistoryList } from "./call-history-list";

interface PatientDetailProps {
  patientId: string;
}

export function PatientDetail({ patientId }: PatientDetailProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [patient, setPatient] = useState<PatientWithMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch patient details using server action
  useEffect(() => {
    const fetchPatient = async () => {
      try {
        setIsLoading(true);
        const data = await getPatient(patientId);
        setPatient(data);
      } catch (error) {
        console.error("Error fetching patient:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatient();
  }, [patientId]);

  if (isLoading) {
    return <PatientDetailSkeleton />;
  }

  if (!patient) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center space-y-2 py-8 text-center">
            <UserIcon className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">Patient Not Found</h3>
            <p className="text-sm text-muted-foreground">
              The requested patient could not be found or you don't have access.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format patient data
  const age = calculateAge(new Date(patient.dob));
  const formattedPhone = formatPhoneDisplay(patient.primaryPhone);
  const patientFullName = `${patient.firstName} ${patient.lastName}`;

  return (
    <div className="space-y-6">
      {patient.primaryPhone}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{patientFullName}</CardTitle>
              <CardDescription>
                {patient.emrIdInOrg && (
                  <span className="mr-2">ID: {patient.emrIdInOrg}</span>
                )}
                {age && (
                  <span>
                    {age} years old (
                    {format(new Date(patient.dob), "MMM d, yyyy")})
                  </span>
                )}
                {patient.isMinor && (
                  <Badge variant="outline" className="ml-2">
                    Minor
                  </Badge>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button size="sm">Create Call</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Contact Information
                </h3>
                <div className="mt-2 grid gap-2">
                  <div className="flex items-center">
                    <PhoneIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{formattedPhone}</span>
                  </div>
                  {patient.secondaryPhone && (
                    <div className="flex items-center">
                      <PhoneIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{formatPhoneDisplay(patient.secondaryPhone)}</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        Secondary
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Patient Information
                </h3>
                <div className="mt-2 grid gap-2">
                  <div className="flex items-center">
                    <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>
                      {patient.firstName} {patient.lastName}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(patient.dob), "MMMM d, yyyy")} ({age}{" "}
                      years old)
                    </span>
                  </div>
                  {patient.emrIdInOrg && (
                    <div className="flex items-center">
                      <ClipboardIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>EMR ID: {patient.emrIdInOrg}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Communication History
                </h3>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Total Calls</span>
                    <Badge variant="outline">{patient.callCount || 0}</Badge>
                  </div>
                  {patient.lastCall && (
                    <div className="flex items-center justify-between">
                      <span>Last Contact</span>
                      <span className="text-sm text-muted-foreground">
                        {format(
                          new Date(patient.lastCall.createdAt),
                          "MMM d, yyyy",
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Account Information
                </h3>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Created On</span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(patient.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calls">Call History</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Recent interactions with this patient
              </CardDescription>
            </CardHeader>
            <CardContent>
              {patient.callCount ? (
                <CallHistoryList patientId={patientId} limit={3} />
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <SparklesIcon className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-2 text-lg font-medium">No Activity Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    This patient doesn't have any recorded interactions yet.
                  </p>
                  <Button className="mt-4" size="sm">
                    Create a Call
                  </Button>
                </div>
              )}
            </CardContent>
            {patient.callCount > 3 && (
              <CardFooter>
                <Button
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setActiveTab("calls")}
                >
                  View All Calls
                  <ChevronRightIcon className="ml-1 h-4 w-4" />
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="calls" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Call History</CardTitle>
              <CardDescription>
                Complete history of calls with this patient
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CallHistoryList patientId={patientId} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="campaigns" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign History</CardTitle>
              <CardDescription>
                Campaigns this patient has been included in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <SparklesIcon className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-2 text-lg font-medium">Coming Soon</h3>
                <p className="text-sm text-muted-foreground">
                  Campaign history view is currently in development.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Skeleton loader for patient details
function PatientDetailSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between">
          <div>
            <div className="bg-gray-200 h-7 w-48 animate-pulse rounded" />
            <div className="bg-gray-200 mt-1 h-5 w-32 animate-pulse rounded" />
          </div>
          <div className="flex space-x-2">
            <div className="bg-gray-200 h-9 w-24 animate-pulse rounded" />
            <div className="bg-gray-200 h-9 w-24 animate-pulse rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <div className="bg-gray-200 h-5 w-32 animate-pulse rounded" />
              <div className="mt-2 space-y-2">
                <div className="bg-gray-200 h-5 w-full animate-pulse rounded" />
                <div className="bg-gray-200 h-5 w-full animate-pulse rounded" />
              </div>
            </div>
            <div>
              <div className="bg-gray-200 h-5 w-32 animate-pulse rounded" />
              <div className="mt-2 space-y-2">
                <div className="bg-gray-200 h-5 w-full animate-pulse rounded" />
                <div className="bg-gray-200 h-5 w-full animate-pulse rounded" />
                <div className="bg-gray-200 h-5 w-full animate-pulse rounded" />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="bg-gray-200 h-5 w-32 animate-pulse rounded" />
              <div className="mt-2 space-y-2">
                <div className="bg-gray-200 h-5 w-full animate-pulse rounded" />
                <div className="bg-gray-200 h-5 w-full animate-pulse rounded" />
              </div>
            </div>
            <div>
              <div className="bg-gray-200 h-5 w-32 animate-pulse rounded" />
              <div className="mt-2 space-y-2">
                <div className="bg-gray-200 h-5 w-full animate-pulse rounded" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
