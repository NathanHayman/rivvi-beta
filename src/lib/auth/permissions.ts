// src/lib/auth.ts
import { db } from "@/server/db";
import { organizations, users } from "@/server/db/schema";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { cache } from "react";

export type AuthContext = {
  userId: string | null;
  orgId: string | null;
  isOrgSuperAdmin: boolean;
  isSuperAdmin: boolean;
};

// Cached helper to get database IDs from Clerk IDs
export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();

  // Check for super admin by current org
  const isOrgSuperAdmin =
    clerkOrgId === process.env.NEXT_PUBLIC_SUPER_ADMIN_ORGANIZATION_ID;
  let isSuperAdmin = isOrgSuperAdmin;

  // Get DB IDs if available
  let dbOrgId = null;
  let dbUserId = null;
  // Get DB user role if available
  let dbUserRole = null;

  if (clerkUserId) {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId),
      columns: { id: true, role: true },
    });
    dbUserId = user?.id || null;
    dbUserRole = user?.role || null;
  }

  if (dbUserRole === "superadmin") {
    isSuperAdmin = true;
  }

  if (clerkOrgId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.clerkId, clerkOrgId),
      columns: { id: true },
    });
    dbOrgId = org?.id || null;
  }

  return {
    userId: dbUserId,
    orgId: dbOrgId,
    isSuperAdmin,
    isOrgSuperAdmin: isSuperAdmin,
  };
});

// Helper for protected actions
export async function requireAuth() {
  const context = await getAuthContext();
  if (!context.userId) {
    throw new Error("Authentication required");
  }
  return context;
}

// Helper for org-scoped actions
export async function requireOrg() {
  const context = await requireAuth();
  if (!context.orgId) {
    throw new Error("Organization required");
  }
  return context;
}

// Helper for admin actions
export async function requireSuperAdmin() {
  const context = await requireAuth();
  if (!context.isSuperAdmin) {
    throw new Error("Admin privileges required");
  }
  return context;
}
