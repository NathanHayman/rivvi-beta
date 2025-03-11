import { AppSidebar } from "@/components/layout/sidebar";
import SuperAdminWidget from "@/components/super-admin-widget";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";

import { SidebarInset } from "@/components/ui/sidebar";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Suspense } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <SuperAdminWidget />
      </Suspense>
      <SidebarProvider>
        <AppSidebar>
          <div className="mx-auto w-[13.5rem] rounded-md px-2 transition-colors duration-200 hover:bg-accent/50 group-data-[collapsible=icon]:w-fit dark:hover:bg-accent/50">
            <UserButton
              appearance={{
                elements: {
                  rootBox: "w-full py-2 group-data-[collapsible=icon]:w-fit",
                  avatarBox: "w-8 h-8 order-first px-4",
                  userButtonTrigger:
                    "w-full group-data-[collapsible=icon]:w-fit focus:outline-none focus:ring-0",
                  userButtonBox:
                    "text-foreground flex justify-start w-full group-data-[collapsible=icon]:w-fit",
                  // this is the box that contains the users name
                  userButtonOuterIdentifier:
                    "group-data-[collapsible=icon]:hidden",
                  // this is the text of the users avatar
                  // userButtonAvatarBox: "bg-blue-500",
                },
              }}
              showName
            />
          </div>
          <OrganizationSwitcher
            fallback={
              <Button variant="outline">
                <UserButton />
              </Button>
            }
            appearance={{
              elements: {
                rootBox:
                  "relative flex flex-col items-center justify-center w-full",
                avatarBox: "w-8 h-8",
                organizationSwitcherTriggerIcon:
                  "group-data-[collapsible=icon]:flex",
                organizationSwitcherTrigger:
                  "group-data-[collapsible=icon]:w-12 h-12 overflow-hidden py-4 w-[13.5rem] text-left text-sm text-accent-foreground dark:text-white dark:hover:bg-accent-foreground/5 dark:focus:bg-accent-foreground/5",
              },
            }}
            hidePersonal
          />
        </AppSidebar>
        <SidebarInset>
          <main style={{ viewTransitionName: "page" }}>{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
