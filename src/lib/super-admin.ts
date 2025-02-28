"use server";

import { auth } from "@clerk/nextjs/server";
import { cache } from "react";

async function checkSuperAdminFunction() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return false;
  }

  return orgId === process.env.NEXT_PUBLIC_SUPER_ADMIN_ORGANIZATION_ID;
}

export const isSuperAdmin = cache(checkSuperAdminFunction);
