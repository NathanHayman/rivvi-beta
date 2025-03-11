import {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
} from "@/components/layout/shell";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Metadata } from "next";
import { Suspense } from "react";
import { MembersSettings } from "./_ui/members-settings";
import { OrganizationSettings } from "./_ui/organization-settings";

export const metadata: Metadata = {
  title: "Settings - Rivvi",
  description:
    "Organization settings for Rivvi's human-like conversational AI for healthcare.",
};

export default async function Settings() {
  return (
    <AppPage>
      <AppBreadcrumbs
        breadcrumbs={[{ title: "Settings", href: "/settings" }]}
      />
      <AppBody>
        <AppHeader title="Organization Settings" />
        <AppContent className="h-full">
          <Tabs defaultValue="organization" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="organization">Organization</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
            </TabsList>
            <TabsContent value="organization" className="space-y-4">
              <Suspense fallback={<SkeletonCard rows={4} rowHeight={12} />}>
                <OrganizationSettings />
              </Suspense>
            </TabsContent>
            <TabsContent value="members" className="space-y-4">
              <Suspense fallback={<SkeletonCard rows={3} rowHeight={16} />}>
                <MembersSettings />
              </Suspense>
            </TabsContent>
          </Tabs>
        </AppContent>
      </AppBody>
    </AppPage>
  );
}
