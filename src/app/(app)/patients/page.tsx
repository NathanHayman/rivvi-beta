import { PatientsTable } from "@/components/app/patient/patients-table";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Card, CardDescription } from "@/components/ui/card";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Patients - Rivvi",
  description:
    "Manage patients for Rivvi's human-like conversational AI for healthcare.",
};

export default async function Patients() {
  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[{ title: "Patients", href: "/patients" }]}
      />
      <AppBody>
        <AppHeader title="Patients" />
        <AppContent className="h-full">
          <div className="space-y-4">
            <Card className="p-6">
              <CardDescription className="mb-6">
                View and manage all patients in your organization. Use the
                search feature to find specific patients by name, phone number,
                or ID.
              </CardDescription>
              <Suspense fallback={<div>Loading...</div>}>
                <PatientsTable />
              </Suspense>
            </Card>
          </div>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
