import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
  AppSpinner,
} from "@/components/layout/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats } from "@/server/actions/admin";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Overview - Rivvi",
  description:
    "Overview of Rivvi's human-like conversational AI for healthcare.",
};

async function OverviewContent() {
  const result = await getDashboardStats();

  if (!result) {
    return <div>Error</div>;
  }

  const { counts } = result;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Total Campaigns</CardTitle>
        </CardHeader>
        <CardContent>{counts?.campaigns}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Total Organizations</CardTitle>
        </CardHeader>
        <CardContent>{counts?.organizations}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Total Calls</CardTitle>
        </CardHeader>
        <CardContent>{counts?.calls}</CardContent>
      </Card>
    </div>
  );
}

export default async function OverviewPage() {
  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Overview", href: "/" }]} />
      <AppBody>
        <AppHeader title="Overview" />
        <AppContent className="h-full">
          <Suspense fallback={<AppSpinner />}>
            <OverviewContent />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
