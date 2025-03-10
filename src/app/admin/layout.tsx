import { AdminSidebar } from "@/components/layout/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OrganizationSwitcher } from "@clerk/nextjs";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminSidebar>
        <OrganizationSwitcher
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
