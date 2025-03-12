"use client";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useSelectedLayoutSegments } from "next/navigation";
import { TNavLinkItem } from "./types";
export function MainLinks({ links }: { links: TNavLinkItem[] }) {
  const pathname = usePathname();
  const segments = useSelectedLayoutSegments();
  const isOrg = segments[0] === "orgs";
  const orgId = segments[1];

  return (
    <SidebarGroup>
      <SidebarMenu className="relative space-y-1">
        {links.map((link) => {
          let isActive =
            pathname === link.href || pathname.startsWith(`${link.href}/`);

          if (isOrg && segments.length > 2) {
            // the first segment is orgs, the second is the orgId, the third is the link
            // if the url is /admin/orgs/1/campaigns, then the link is active but the overview is not
            isActive =
              pathname === `/admin/orgs/${orgId}/${link.href}` ||
              pathname.startsWith(`/admin/orgs/${orgId}/${link.href}/`);
          }

          return (
            <SidebarMenuItem key={link.title} className="ml-[0.385rem]">
              <motion.hr
                // add a vertical purple line if the link is active
                initial={{ opacity: 0, x: 0, height: 0 }}
                animate={{
                  opacity: isActive ? 0.75 : 0,
                  x: isActive ? -10 : -50,
                  y: isActive ? 0 : 10,
                  height: isActive ? "100%" : 0,
                  width: isActive ? 5 : 0,
                }}
                transition={{ duration: 0.3, ease: "circInOut" }}
                className="absolute inset-0 -left-1 bottom-0 top-0 z-[999] h-12 w-1 rotate-90 self-start rounded-lg bg-primary"
              />
              <SidebarMenuButton
                asChild
                className={cn(
                  "h-full w-full border border-transparent py-0 transition-all duration-300 ease-in-out",
                  "focus:outline-1 focus:outline-offset-0 focus:outline-accent-foreground/5 group-data-[collapsible=icon]:p-0",
                  isActive
                    ? "bg-accent-foreground/[0.05] text-accent-foreground hover:bg-accent-foreground/5 hover:text-accent-foreground"
                    : "",
                )}
              >
                <Link
                  prefetch={false}
                  href={link.href ?? "/"}
                  className="relative w-fit group-data-[collapsible=icon]:p-0"
                >
                  {link.icon && (
                    <link.icon.icon
                      iconClassName={cn(
                        "size-[1.15rem]",
                        "group-data-[collapsible=icon]:mx-auto",
                        isActive
                          ? "text-accent-foreground"
                          : "text-accent-foreground/50",
                      )}
                      className={cn(
                        "flex h-9 w-full items-center justify-start p-0 transition-all duration-300 ease-in-out",
                        "group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-8",
                        isActive
                          ? "text-accent-foreground"
                          : "text-accent-foreground/50",
                      )}
                    >
                      <span className="text-sm leading-9 group-data-[collapsible=icon]:hidden">
                        {link.title}
                      </span>
                    </link.icon.icon>
                  )}
                  <span className="sr-only">{link.icon?.iconTitle}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
