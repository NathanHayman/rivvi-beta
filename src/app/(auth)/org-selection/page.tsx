"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrganizationList } from "@clerk/nextjs";
import Image from "next/image";
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
      appearance={{
        elements: {
          rootBox: "w-full",
          card: "shadow-none border-0 p-0",
          organizationPreviewTextContainer: "font-medium",
        },
      }}
    />
  );
}

export default function OrganizationSelection() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4 dark:bg-slate-950">
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center space-y-6">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="rounded-full bg-primary/10 p-3">
            <Image
              src="/favicon.ico"
              alt="Rivvi Logo"
              width={40}
              height={40}
              priority
              className="h-10 w-10"
            />
          </div>
          <h1 className="text-2xl font-bold">Select an Organization</h1>
          <p className="text-muted-foreground">
            Please select an organization to continue using the platform.
          </p>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Your Organizations</CardTitle>
            <CardDescription>
              Select an organization to access its data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
                </div>
              }
            >
              <OrganizationSelector />
            </Suspense>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Can't find your organization? Contact your administrator for an
              invitation.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
