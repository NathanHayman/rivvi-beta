import { AdminOverview } from "@/app/admin/_ui/overview";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
  AppSpinner,
} from "@/components/layout/shell";
import { getDashboardStats } from "@/server/actions/admin";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Overview - Rivvi",
  description:
    "Overview of Rivvi's human-like conversational AI for healthcare.",
};

async function AdminOverviewContent() {
  const result = await getDashboardStats();

  if (!result) {
    return <div>Error</div>;
  }

  const { counts } = result;

  return <AdminOverview counts={counts} />;
}

export default async function AdminOverviewPage() {
  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Overview", href: "/" }]} />
      <AppBody>
        <AppHeader title="Overview" />
        <AppContent className="h-full">
          <Suspense fallback={<AppSpinner />}>
            <AdminOverviewContent />
          </Suspense>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
