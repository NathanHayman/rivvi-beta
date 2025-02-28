import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

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
            title: `Patient Full Name`,
            href: `/patients/${patientId}`,
          },
        ]}
      />
      <AppBody>
        <AppHeader
          className=""
          title={`Patient Full Name`}
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
        <AppContent>TODO: Add patient details</AppContent>
      </AppBody>
    </AppPage>
  );
}
