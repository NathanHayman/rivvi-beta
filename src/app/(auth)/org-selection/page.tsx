"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrganizationList } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function OrganizationSelector() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirectUrl") ?? "/";

  return (
    <OrganizationList
      hidePersonal={true}
      afterCreateOrganizationUrl={redirectUrl}
      afterSelectOrganizationUrl={redirectUrl}
    />
  );
}

export default function OrganizationSelection() {
  return (
    <div className="container min-h-screen max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Select Organization</CardTitle>
          <CardDescription>
            Please select an organization to proceed. If you are not part of an
            organization, you can accept an invitation or create your own
            organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading organizations...</div>}>
            <OrganizationSelector />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
