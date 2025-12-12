import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";
import { cache } from "react";

// Shared query client options
export const queryClientOptions = {
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
      retry: 1,
    },
    dehydrate: {
      // Include pending queries so they can be streamed
      shouldDehydrateQuery: (query: unknown) =>
        defaultShouldDehydrateQuery(query as Parameters<typeof defaultShouldDehydrateQuery>[0]) ||
        (query as { state: { status: string } }).state.status === "pending",
    },
  },
};

// Create a query client for server-side use
// Using React's cache() ensures we get a single instance per request
export const getQueryClient = cache(() => new QueryClient(queryClientOptions));

// Re-export for convenience
export { dehydrate, HydrationBoundary } from "@tanstack/react-query";
