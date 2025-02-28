import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calls - Rivvi",
  description: "Calls for Rivvi's human-like conversational AI for healthcare.",
};

export default async function Campaigns() {
  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Campaigns", href: "/" }]} />
      <AppBody>
        <AppHeader title="Campaigns" />
        <AppContent className="h-full">TODO: Add campaigns table</AppContent>
      </AppBody>
    </AppPage>
  );
}
