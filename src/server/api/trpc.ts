// src/server/api/trpc.ts

/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { isSuperAdmin } from "@/lib/super-admin";
import { db } from "@/server/db";
import { organizations, users } from "@/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  // Get the user's org from Clerk
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();

  // Determine if the user is a super admin
  const isSuperAdminUser = clerkOrgId ? await isSuperAdmin(clerkOrgId) : false;

  // If the user has an orgId, get the organization details from our DB
  let organization = null;
  if (clerkOrgId) {
    const orgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkId, clerkOrgId));
    organization = orgs[0] || null;
  }

  // If the user has a userId, get the user details from our DB
  let user = null;
  if (clerkUserId) {
    const _users = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId));
    user = _users[0] || null;
  }

  return {
    db,
    auth: {
      userId: user?.id,
      orgId: organization?.id,
      organization,
      isSuperAdmin: isSuperAdminUser,
    },
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Auth middleware - ensures the user is authenticated
 */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }
  return next({
    ctx: {
      auth: {
        ...ctx.auth,
        userId: ctx.auth.userId,
      },
    },
  });
});

/**
 * Super admin middleware - ensures the user is a super admin
 */
const enforceSuperAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }

  if (!ctx.auth.isSuperAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a super admin to perform this action",
    });
  }

  return next({
    ctx: {
      auth: {
        ...ctx.auth,
        userId: ctx.auth.userId,
      },
    },
  });
});

/**
 * Organization middleware - ensures the user has an active organization
 */
const enforceOrganization = t.middleware(({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }

  if (!ctx.auth.orgId || !ctx.auth.organization) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be part of an organization to perform this action",
    });
  }

  return next({
    ctx: {
      auth: {
        ...ctx.auth,
        userId: ctx.auth.userId,
        orgId: ctx.auth.orgId,
        organization: ctx.auth.organization,
      },
    },
  });
});

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * This procedure ensures the user is authenticated before running the procedure.
 */
export const protectedProcedure = t.procedure
  .use(enforceAuth)
  .use(timingMiddleware);

/**
 * Organization procedure
 *
 * This procedure ensures the user is authenticated and has an active organization.
 */
export const orgProcedure = t.procedure
  .use(enforceOrganization)
  .use(timingMiddleware);

/**
 * Super admin procedure
 *
 * This procedure ensures the user is authenticated and is a super admin.
 */
export const superAdminProcedure = t.procedure
  .use(enforceSuperAdmin)
  .use(timingMiddleware);
