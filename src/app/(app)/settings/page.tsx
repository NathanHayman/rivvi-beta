import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings - Rivvi",
  description:
    "Settings for Rivvi's human-like conversational AI for healthcare.",
};

export default async function Settings() {
  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Settings", href: "/" }]} />
      <AppBody>
        <AppHeader title="Settings" />
        <AppContent className="h-full">TODO: Add settings</AppContent>
      </AppBody>
    </AppPage>
  );
}
