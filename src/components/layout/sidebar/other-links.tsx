"use client";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TNavLinkItem } from "./types";

export function OtherLinks({ links }: { links: TNavLinkItem[] }) {
  const pathname = usePathname();

  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupContent>
        <SidebarMenu className="space-y-0.5">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <SidebarMenuItem
                key={link.title}
                className="relative ml-[0.385rem]"
              >
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
                  size="sm"
                  className={cn(
                    "border border-transparent py-0 transition-all duration-300 ease-in-out",
                    "focus:outline-1 focus:outline-offset-0 focus:outline-accent-foreground/5",
                    isActive
                      ? "bg-accent-foreground/[0.05] text-accent-foreground hover:bg-accent-foreground/5 hover:text-accent-foreground"
                      : "",
                  )}
                >
                  <Link
                    prefetch={false}
                    href={link.href ?? "/"}
                    className="relative flex h-full w-full items-center gap-2 px-2.5 transition-all duration-300 ease-in-out"
                  >
                    {link.icon && (
                      <link.icon.icon
                        className={cn(
                          "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-[1.05rem]",
                          link.icon.iconClassName,
                          "text-accent-foreground/50",
                          isActive && "text-accent-foreground",
                        )}
                      />
                    )}
                    <span className="sr-only">{link.icon?.iconTitle}</span>
                    {/* hide this when collapsed */}
                    <span className="leading-9 group-data-[collapsible=icon]:hidden">
                      {link.title}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          <SidebarMenuItem className="w-full">
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
