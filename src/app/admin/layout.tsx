import { AdminSidebar } from "@/components/layout/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminSidebar>
        <div className="mx-auto w-[13.5rem] rounded-md px-2 transition-colors duration-200 hover:bg-accent">
          <UserButton
            appearance={{
              elements: {
                rootBox: "w-full px-4 py-2",
                avatarBox: "w-8 h-8 order-first",
                userButtonBox: "text-foreground",
              },
            }}
            showName
          />
        </div>
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
