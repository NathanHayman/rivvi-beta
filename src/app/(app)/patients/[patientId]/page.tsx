import { PatientDetail } from "@/components/app/patient/patient-detail";
import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Patient Details - Rivvi",
  description:
    "View and manage patient information in Rivvi's healthcare communication platform.",
};

type PageProps = {
  params: Promise<{ patientId: string }>;
};

export default async function PatientPage({ params }: PageProps) {
  const { patientId } = await params;

  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[
          { title: "Patients", href: "/patients" },
          {
            title: `Patient Details`,
            href: `/patients/${patientId}`,
          },
        ]}
      />
      <AppBody>
        <AppHeader
          className=""
          title={`Patient Details`}
          buttons={
            <>
              <Link
                href={`/calls?patientId=${patientId}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                View Calls
              </Link>
            </>
          }
        />
        <AppContent>
          <PatientDetail patientId={patientId} />
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
