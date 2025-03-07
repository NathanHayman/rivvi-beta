"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Phone, Users } from "lucide-react";
import { useRouter } from "next/navigation";

interface OrganizationDetailsProps {
  organizationId: string;
}

export function OrganizationDetails({
  organizationId,
}: OrganizationDetailsProps) {
  const router = useRouter();
  const { data: organization, isLoading } = api.organizations.getById.useQuery({
    id: organizationId,
  });

  const { data: members, isLoading: isLoadingMembers } =
    api.organizations.getMembers.useQuery({
      organizationId,
    });

  if (isLoading) {
    return <OrganizationDetailsSkeleton />;
  }

  if (!organization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>The organization could not be found.</p>
        </CardContent>
      </Card>
    );
  }

  const handleEditClick = () => {
    router.push(`/admin/orgs/${organizationId}/edit`);
  };

  const formatOfficeHours = (day: string) => {
    const hours =
      organization.officeHours?.[day as keyof typeof organization.officeHours];
    if (!hours) return "Closed";
    return `${hours.start} - ${hours.end}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Organization Details</CardTitle>
          <Button size="sm" variant="outline" onClick={handleEditClick}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Name
              </h3>
              <p className="mt-1">{organization.name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Clerk ID
              </h3>
              <p className="mt-1 font-mono text-sm">{organization.clerkId}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Phone
              </h3>
              <p className="mt-1 flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {organization.phone || "Not set"}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Timezone
              </h3>
              <p className="mt-1">{organization.timezone || "Not set"}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Concurrent Call Limit
              </h3>
              <p className="mt-1">{organization.concurrentCallLimit || 20}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Organization Type
              </h3>
              <p className="mt-1">
                {organization.isSuperAdmin ? "Super Admin" : "Standard"}
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          <div>
            <h3 className="text-sm font-medium">Office Hours</h3>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <div className="rounded-md border p-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Monday
                </span>
                <p className="text-sm">{formatOfficeHours("monday")}</p>
              </div>
              <div className="rounded-md border p-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Tuesday
                </span>
                <p className="text-sm">{formatOfficeHours("tuesday")}</p>
              </div>
              <div className="rounded-md border p-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Wednesday
                </span>
                <p className="text-sm">{formatOfficeHours("wednesday")}</p>
              </div>
              <div className="rounded-md border p-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Thursday
                </span>
                <p className="text-sm">{formatOfficeHours("thursday")}</p>
              </div>
              <div className="rounded-md border p-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Friday
                </span>
                <p className="text-sm">{formatOfficeHours("friday")}</p>
              </div>
              <div className="rounded-md border p-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Saturday
                </span>
                <p className="text-sm">{formatOfficeHours("saturday")}</p>
              </div>
              <div className="rounded-md border p-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Sunday
                </span>
                <p className="text-sm">{formatOfficeHours("sunday")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingMembers ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : members && members.members.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {members.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.email}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {member.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {members.totalCount > members.members.length && (
                <p className="text-center text-sm text-muted-foreground">
                  + {members.totalCount - members.members.length} more members
                </p>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">
              No members found.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrganizationDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-9 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-1 h-4 w-20" />
                <Skeleton className="h-6 w-full" />
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          <div>
            <Skeleton className="mb-2 h-5 w-28" />
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {[...Array(7)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
