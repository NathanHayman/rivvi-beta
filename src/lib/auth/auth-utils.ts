import { createClerkClient } from "@clerk/nextjs/server";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export const clerk = clerkClient;

export async function inviteUserToOrganization(
  organizationId: string,
  emailAddress: string,
  role: "member" | "admin" | "superadmin",
) {
  const result = await clerk.organizations.createOrganizationInvitation({
    organizationId,
    emailAddress,
    role,
  });

  if (!result) {
    throw new Error("Failed to invite user to organization");
  }

  return result;
}
