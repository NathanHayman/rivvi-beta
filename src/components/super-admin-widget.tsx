"use client";

import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { Settings } from "lucide-react";
import Link from "next/link";
import { cache } from "react";
import { buttonVariants } from "./ui/button";

const SuperAdminWidget = () => {
  const { data, isLoading } = api.organizations.isSuperAdmin.useQuery();

  // Don't render anything if loading or if user is not a super admin
  if (isLoading || !data?.isSuperAdmin) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center">
      <Link
        href="/admin"
        className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
      >
        <Settings />
        <span className="sr-only">Admin</span>
        Super Admin Dashboard
      </Link>
    </div>
  );
};

export default cache(SuperAdminWidget);
