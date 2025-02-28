"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SuperJSON from "superjson";

import { type AppRouter } from "@/server/api/root";
import { createQueryClient } from "./query-client";

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  return (clientQueryClientSingleton ??= createQueryClient());
};

export const api = createTRPCReact<AppRouter>();

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

/**
 * Error handler component that redirects to login page on auth errors
 */
function TRPCErrorHandler() {
  const router = useRouter();
  const queryClient = getQueryClient();

  useEffect(() => {
    // Set up global error handler for React Query
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.state.error) {
        const error = event.query.state.error;

        // Check if it's a tRPC error with authentication issues
        if (
          typeof error === "object" &&
          error !== null &&
          "data" in error &&
          error.data &&
          typeof error.data === "object"
        ) {
          const trpcError = error.data as { code?: string; message?: string };

          if (
            trpcError.code === "UNAUTHORIZED" ||
            trpcError.code === "FORBIDDEN" ||
            (typeof trpcError.message === "string" &&
              (trpcError.message.includes("logged in") ||
                trpcError.message.includes("part of an organization")))
          ) {
            // Redirect to login page
            router.push("/login");
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [router, queryClient]);

  return null;
}

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        unstable_httpBatchStreamLink({
          transformer: SuperJSON,
          url: getBaseUrl() + "/api/trpc",
          headers: () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "nextjs-react");
            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        <TRPCErrorHandler />
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
