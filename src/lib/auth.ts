// src/lib/auth.ts
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cache } from "react";

export type AuthContext = {
  userId: string | null;
  orgId: string | null;
  isSuperAdmin: boolean;
};

// Cached helper to get database IDs from Clerk IDs
export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  
  // Check for super admin
  const isSuperAdmin = clerkOrgId === process.env.NEXT_PUBLIC_SUPER_ADMIN_ORGANIZATION_ID;
  
  // Get DB IDs if available
  let dbUserId = null;
  let dbOrgId = null;
  
  if (clerkUserId) {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId),
      columns: { id: true }
    });
    dbUserId = user?.id || null;
  }
  
  if (clerkOrgId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.clerkId, clerkOrgId),
      columns: { id: true }
    });
    dbOrgId = org?.id || null;
  }
  
  return { userId: dbUserId, orgId: dbOrgId, isSuperAdmin };
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