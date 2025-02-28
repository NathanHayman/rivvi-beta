import { AdminSidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";

import { SidebarInset } from "@/components/ui/sidebar";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminSidebar>
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
      </AdminSidebar>
      <SidebarInset>
        <main style={{ viewTransitionName: "page" }}>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
