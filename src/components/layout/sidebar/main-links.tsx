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
      <SidebarMenu className="space-y-0.5 relative ">
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
                className="w-1 h-12 rotate-90 inset-0 z-[999] bg-primary absolute top-0 -left-1 bottom-0 self-start rounded-lg"
              />
              <SidebarMenuButton
                asChild
                className={cn(
                  "py-0 border border-transparent transition-all duration-300 ease-in-out",
                  "focus:outline-1 focus:outline-accent-foreground/5 focus:outline-offset-0 ",
                  isActive
                    ? "bg-accent-foreground/[0.05] text-accent-foreground hover:bg-accent-foreground/5 hover:text-accent-foreground"
                    : ""
                )}
              >
                <Link
                  prefetch={false}
                  href={link.href ?? "/"}
                  className="flex items-center gap-2 relative transition-all duration-300 ease-in-out w-full h-full px-2.5"
                >
                  {link.icon && (
                    <link.icon.icon
                      className={cn(
                        "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-[1.0625rem]",
                        isActive
                          ? "text-accent-foreground"
                          : "text-accent-foreground/50"
                      )}
                    />
                  )}
                  <span className="sr-only">{link.icon?.iconTitle}</span>
                  <span className="group-data-[collapsible=icon]:hidden text-sm leading-9">
                    {link.title}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
