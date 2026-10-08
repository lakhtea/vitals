"use client";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import type { ReactNode } from "react";

/**
 * Apollo Client with the default normalized cache.
 *
 * SESSION TODO (SSR lesson): move to @apollo/client-integration-nextjs for
 * streaming SSR + RSC support, and write up the tradeoff in the README.
 */
const client = new ApolloClient({
  link: new HttpLink({ uri: "/api/graphql" }),
  cache: new InMemoryCache(),
});

export function Providers({ children }: { children: ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
