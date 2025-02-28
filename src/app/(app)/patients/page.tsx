import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Patients - Rivvi",
  description:
    "Patients for Rivvi's human-like conversational AI for healthcare.",
};

export default async function Patients() {
  return (
    <AppPage>
      <AppBreadcrumbs breadcrumbs={[{ title: "Patients", href: "/" }]} />
      <AppBody>
        <AppHeader title="Patients" />
        <AppContent className="h-full">TODO: Add patients table</AppContent>
      </AppBody>
    </AppPage>
  );
}
