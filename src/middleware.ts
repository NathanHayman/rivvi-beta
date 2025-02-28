import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/waitlist(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/webhooks/retell(.*)",
  "/api/trpc(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
    // Get the user and org id
    const { userId, orgId } = await auth();

    // Redirect signed in users to organization selection page if they are not active in an organization
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
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
