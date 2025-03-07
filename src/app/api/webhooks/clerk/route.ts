// src/app/api/webhooks/clerk/route.ts
import { db } from "@/server/db";
import { organizations, users } from "@/server/db/schema";
import { WebhookEvent } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

export async function POST(req: Request) {
  // Get the Clerk webhook secret
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("Missing Clerk webhook secret");
    return NextResponse.json(
      { error: "Missing webhook secret" },
      { status: 500 },
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: "Missing required Svix headers" },
      { status: 400 },
    );
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with the webhook secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the webhook
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }

  // Handle the webhook event
  try {
    const { type, data } = evt;

    console.log(`Processing Clerk webhook: ${type}`);

    switch (type) {
      // User-related events
      case "user.created":
        await handleUserCreated(data);
        break;
      case "user.updated":
        await handleUserUpdated(data);
        break;
      case "user.deleted":
        await handleUserDeleted(data);
        break;

      // Organization-related events
      case "organization.created":
        await handleOrganizationCreated(data);
        break;
      case "organization.updated":
        await handleOrganizationUpdated(data);
        break;
      case "organization.deleted":
        await handleOrganizationDeleted(data);
        break;

      // Organization membership events
      case "organizationMembership.created":
        await handleOrganizationMembershipCreated(data);
        break;
      case "organizationMembership.deleted":
        await handleOrganizationMembershipDeleted(data);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error handling webhook:", error);
    return NextResponse.json(
      { error: "Error handling webhook" },
      { status: 500 },
    );
  }
}

// Handler functions

async function handleUserCreated(data: any) {
  const { id, email_addresses, first_name, last_name } = data;

  if (!id || !email_addresses || !email_addresses.length) {
    console.error("Invalid user data in webhook");
    return;
  }

  // Get primary email
  const primaryEmail = email_addresses.find(
    (email: any) => email.id === data.primary_email_address_id,
  );
  const email = primaryEmail
    ? primaryEmail.email_address
    : email_addresses[0].email_address;

  // Check if user already exists
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, id));

  if (existingUsers.length > 0) {
    console.log(`User ${id} already exists, updating`);
    await db
      .update(users)
      .set({
        email,
        firstName: first_name,
        lastName: last_name,
        updatedAt: new Date(),
      } as Partial<typeof users.$inferInsert>)
      .where(eq(users.clerkId, id));
    return;
  }

  // Create new user
  await db.insert(users).values({
    clerkId: id,
    email,
    firstName: first_name,
    lastName: last_name,
  } as typeof users.$inferInsert);

  console.log(`User ${id} created`);
}

async function handleUserUpdated(data: any) {
  const { id, email_addresses, first_name, last_name } = data;

  if (!id) {
    console.error("Invalid user data in webhook");
    return;
  }

  // Get primary email if available
  let email;
  if (email_addresses && email_addresses.length) {
    const primaryEmail = email_addresses.find(
      (email: any) => email.id === data.primary_email_address_id,
    );
    email = primaryEmail
      ? primaryEmail.email_address
      : email_addresses[0].email_address;
  }

  // Update user data
  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (email) updateData.email = email;
  if (first_name !== undefined) updateData.firstName = first_name;
  if (last_name !== undefined) updateData.lastName = last_name;
  // Only update if we have data to update
  if (Object.keys(updateData).length > 1) {
    await db.update(users).set(updateData).where(eq(users.clerkId, id));

    console.log(`User ${id} updated`);
  }
}

async function handleUserDeleted(data: any) {
  const { id } = data;

  if (!id) {
    console.error("Invalid user data in webhook");
    return;
  }

  // Delete the user
  await db.delete(users).where(eq(users.clerkId, id));

  console.log(`User ${id} deleted`);
}

async function handleOrganizationCreated(data: any) {
  const { id, name } = data;

  if (!id || !name) {
    console.error("Invalid organization data in webhook");
    return;
  }

  // Check if organization already exists
  const existingOrgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkId, id));

  if (existingOrgs.length > 0) {
    console.log(`Organization ${id} already exists, updating`);
    await db
      .update(organizations)
      .set({
        name,
        updatedAt: new Date(),
      } as Partial<typeof organizations.$inferInsert>)
      .where(eq(organizations.clerkId, id));
    return;
  }

  // Create new organization
  await db.insert(organizations).values({
    clerkId: id,
    name,
    // Set default values
    timezone: "America/New_York",
    concurrentCallLimit: 20,
    isSuperAdmin: false,
  } as typeof organizations.$inferInsert);

  console.log(`Organization ${id} created`);
}

async function handleOrganizationUpdated(data: any) {
  const { id, name } = data;

  if (!id) {
    console.error("Invalid organization data in webhook");
    return;
  }

  // Update organization
  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (name !== undefined) updateData.name = name;

  // Only update if we have data to update
  if (Object.keys(updateData).length > 1) {
    await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.clerkId, id));

    console.log(`Organization ${id} updated`);
  }
}

async function handleOrganizationDeleted(data: any) {
  const { id } = data;

  if (!id) {
    console.error("Invalid organization data in webhook");
    return;
  }

  // Delete the organization (cascade will handle related records)
  await db.delete(organizations).where(eq(organizations.clerkId, id));

  console.log(`Organization ${id} deleted`);
}

async function handleOrganizationMembershipCreated(data: any) {
  const { organization, public_user_data } = data;

  if (!organization?.id || !public_user_data?.user_id) {
    console.error("Invalid membership data in webhook");
    return;
  }

  const clerkOrgId = organization.id;
  const clerkUserId = public_user_data.user_id;

  // Find the user and organization in our database
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId));

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkId, clerkOrgId));

  if (!user || !org) {
    console.error(`User ${clerkUserId} or org ${clerkOrgId} not found`);
    return;
  }

  // Link user to organization
  await db
    .update(users)
    .set({
      orgId: org.id,
      updatedAt: new Date(),
    } as Partial<typeof users.$inferInsert>)
    .where(eq(users.id, user.id));

  console.log(`User ${clerkUserId} added to organization ${clerkOrgId}`);
}

async function handleOrganizationMembershipDeleted(data: any) {
  const { organization, public_user_data } = data;

  if (!organization?.id || !public_user_data?.user_id) {
    console.error("Invalid membership data in webhook");
    return;
  }

  const clerkOrgId = organization.id;
  const clerkUserId = public_user_data.user_id;

  // Find the user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId));

  if (!user) {
    console.error(`User ${clerkUserId} not found`);
    return;
  }

  // Remove organization link
  await db
    .update(users)
    .set({
      orgId: null,
      updatedAt: new Date(),
    } as Partial<typeof users.$inferInsert>)
    .where(eq(users.id, user.id));

  console.log(`User ${clerkUserId} removed from organization ${clerkOrgId}`);
}
