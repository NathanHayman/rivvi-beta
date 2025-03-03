"use client";

import { api } from "@/trpc/react";
import { Shield } from "lucide-react";
import Link from "next/link";
import { cache } from "react";
import { Badge } from "./ui/badge";

const SuperAdminWidget = () => {
  const { data, isLoading } = api.organizations.isSuperAdmin.useQuery();

  if (isLoading) {
    return null;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-0 right-0 z-[9999] flex justify-center">
      <Link href="/admin" className="">
        <Badge className="flex items-center gap-2 rounded-full p-4 text-base font-bold">
          <Shield />
          <span className="sr-only">Admin</span>
          Super Admin Dashboard
        </Badge>
      </Link>
    </div>
  );
};

export default cache(SuperAdminWidget);
