import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
        // Add retry behavior that doesn't retry auth errors
        retry: (failureCount, error) => {
          // Don't retry if it's an authentication error
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
              return false; // Don't retry auth errors
            }
          }

          // Default retry behavior (3 times)
          return failureCount < 3;
        },
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
