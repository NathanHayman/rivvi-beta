import { cache } from "react";

function checkSuperAdminFunction(clerkOrgId: string) {
  return clerkOrgId === process.env.NEXT_PUBLIC_SUPER_ADMIN_ORGANIZATION_ID;
}

export const isSuperAdmin = cache(checkSuperAdminFunction);
