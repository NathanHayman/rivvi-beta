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

export default async function Calls() {
  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Calls", href: "/" }]} />
      <AppBody>
        <AppHeader title="Calls" />
        <AppContent className="h-full">TODO: Add calls table</AppContent>
      </AppBody>
    </AppPage>
  );
}
