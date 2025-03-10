import { CampaignCreateForm } from "@/components/forms/campaign-create-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCampaignRequestById } from "@/server/actions/campaigns/request";
import { notFound } from "next/navigation";
import { Suspense } from "react";

interface CampaignNewPageProps {
  searchParams: Promise<{
    requestId?: string;
    orgId?: string;
  }>;
}

async function CampaignFromRequest({ requestId }: { requestId: string }) {
  if (!requestId) {
    return notFound();
  }

  try {
    const request = await getCampaignRequestById(requestId);

    if (!request) {
      return notFound();
    }

    return (
      <div>
        <CampaignCreateForm requestId={requestId} />
      </div>
    );
  } catch (error) {
    console.error("Error fetching campaign request:", error);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error</CardTitle>
          <CardDescription>
            Failed to load campaign request information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>There was an error loading the campaign request data.</p>
        </CardContent>
        <CardFooter>
          <Button variant="outline">Go Back</Button>
        </CardFooter>
      </Card>
    );
  }
}

export default async function CampaignNewPage({
  searchParams,
}: CampaignNewPageProps) {
  const { requestId } = await searchParams;

  if (!requestId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Missing Information</CardTitle>
          <CardDescription>
            Required parameters are missing from the URL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            This page requires a campaign request ID to create a new campaign.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline">Go Back</Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="mb-6 text-3xl font-bold">Create New Campaign</h1>
      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-24" />
            </CardFooter>
          </Card>
        }
      >
        <CampaignFromRequest requestId={requestId} />
      </Suspense>
    </div>
  );
}
