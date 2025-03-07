import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/server/actions/organizations";
import { Shield } from "lucide-react";
import Link from "next/link";
import { cache } from "react";

const SuperAdminWidget = async () => {
  const isUserSuperAdmin = await isSuperAdmin();

  if (!isUserSuperAdmin) {
    return null;
  }

  return (
    <div className="fixed right-6 top-6 z-[9999] flex w-full max-w-sm items-center justify-center">
      <Link
        href="/admin"
        className={cn(
          "group flex w-full max-w-fit items-center justify-center gap-2.5 rounded-full border border-primary/60 bg-gradient-to-r from-primary to-primary/90 px-4 py-2.5",
          "text-primary-foreground shadow-lg transition-all duration-300 hover:shadow-xl",
          "hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50",
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20 p-1.5 backdrop-blur-sm">
          <Shield className="h-4 w-4 fill-primary-foreground/60 text-primary-foreground" />
        </div>
        <span className="text-sm font-bold">Super Admin</span>
      </Link>
    </div>
  );
};

export default cache(SuperAdminWidget);
