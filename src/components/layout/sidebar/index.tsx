"use client";

import * as React from "react";

import { Logo, LogoMarkSquare } from "@/components/shared/logos/rivvi-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { SIDEBAR_CONTENT } from "./content";
import { MainLinks } from "./main-links";
import { OtherLinks } from "./other-links";

export function AppSidebar({
  children,
  ...props
}: React.ComponentProps<typeof Sidebar> & { children?: React.ReactNode }) {
  return (
    <Sidebar
      {...props}
      collapsible="icon"
      variant="inset"
      className="inset-0 min-h-screen bg-sidebar p-0"
    >
      <SidebarHeader className="flex flex-row items-center justify-between p-4 group-data-[collapsible=icon]:px-5">
        <Link
          prefetch={false}
          href="/"
          className="!group-data-[collapsible=icon]:space-x-0 flex flex-row items-center justify-start space-x-1.5"
        >
          <LogoMarkSquare className="h-8 w-8" />
          <Logo
            className="h-auto items-start justify-start p-1 group-data-[collapsible=icon]:hidden"
            typeClassName="text-2xl h-auto leading-none group-data-[collapsible=icon]:hidden transition-all duration-300 ease-in delay-100"
            markClassName="h-[1.35rem] w-fit group-data-[collapsible=icon]:w-fit group-data-[collapsible=icon]:-translate-x-2 transition-all duration-300 ease-in delay-100"
            variant="type"
          />
        </Link>
        <SidebarTrigger className="-mr-2 text-accent-foreground/50 group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>
      <SidebarContent className="w-full pb-1 pt-10">
        <MainLinks links={SIDEBAR_CONTENT["links"]} />

        <OtherLinks links={SIDEBAR_CONTENT["other_links"]} />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="px-2 py-4">
        {children}
        <aside className="mt-auto flex flex-col gap-2 p-2 group-data-[collapsible=icon]:hidden">
          <Card>
            <CardHeader>
              <CardTitle>Usage Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={50} />
            </CardContent>
          </Card>
        </aside>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function AdminSidebar({
  children,
  ...props
}: React.ComponentProps<typeof Sidebar> & { children?: React.ReactNode }) {
  return (
    <Sidebar
      {...props}
      collapsible="icon"
      variant="inset"
      className="inset-0 min-h-screen bg-sidebar p-0"
    >
      <SidebarHeader className="flex flex-row items-center justify-between p-4 group-data-[collapsible=icon]:px-5">
        <Link
          prefetch={false}
          href="/"
          className="!group-data-[collapsible=icon]:space-x-0 flex flex-row items-center justify-start space-x-1.5"
        >
          <LogoMarkSquare className="h-8 w-8" />
          <Logo
            className="h-auto items-start justify-start p-1 group-data-[collapsible=icon]:hidden"
            typeClassName="text-2xl h-auto leading-none group-data-[collapsible=icon]:hidden transition-all duration-300 ease-in delay-100"
            markClassName="h-[1.35rem] w-fit group-data-[collapsible=icon]:w-fit group-data-[collapsible=icon]:-translate-x-2 transition-all duration-300 ease-in delay-100"
            variant="type"
          />
        </Link>
        <SidebarTrigger className="-mr-2 text-accent-foreground/50 group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>
      <SidebarContent className="w-full pb-1 pt-10">
        {/* {!isOrg && (
          <AppBreadcrumbs
            breadcrumbs={[{ title: "<- Organizations", href: "/admin/orgs" }]}
          />
        )} */}
        <MainLinks links={SIDEBAR_CONTENT["admin_links"]} />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="px-2 py-4">
        {children}
        <aside className="mt-auto flex flex-col gap-2 p-2 group-data-[collapsible=icon]:hidden">
          <Card>
            <CardHeader>
              <CardTitle>Usage Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={50} />
            </CardContent>
          </Card>
        </aside>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
