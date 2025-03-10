// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that don't require auth
const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/waitlist(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/webhooks/retell(.*)",
  "/api/ai-stream(.*)",
  "/api/ai(.*)",
  "/api/ai/playground(.*)",
  "/api/runs(.*)",
  "/api/runs/[runId]/upload(.*)",
]);

// Create middleware to check auth and org selection
export default clerkMiddleware(async (auth, request) => {
  // Skip auth check for public routes
  if (!isPublicRoute(request)) {
    // Protect route - redirects to sign-in if not authenticated
    await auth.protect();

    // Get user and org IDs
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Redirect to org selection if user has no active org
    if (userId && !orgId && request.nextUrl.pathname !== "/org-selection") {
      const searchParams = new URLSearchParams({
        redirectUrl: request.url,
      });

      const orgSelection = new URL(
        `/org-selection?${searchParams.toString()}`,
        request.url,
      );

      return NextResponse.redirect(orgSelection);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
