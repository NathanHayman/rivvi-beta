import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Overview - Rivvi",
  description:
    "Overview of Rivvi's human-like conversational AI for healthcare.",
};

export default async function OverviewPage() {
  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Overview", href: "/" }]} />
      <AppBody>
        <AppHeader title="Overview" />
        <AppContent className="h-full">Hello</AppContent>
      </AppBody>
    </AppPage>
  );
}
