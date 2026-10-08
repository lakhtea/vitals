// The Apollo Client for React Server Components: one instance per request,
// executing against the Pothos schema in-process. The first paint therefore
// never makes an HTTP round trip to our own /api/graphql.
import "server-only";
import { SchemaLink } from "@apollo/client/link/schema";
import { ApolloClient, InMemoryCache, registerApolloClient } from "@apollo/client-integration-nextjs";
import { createContext } from "@/graphql/context";
import { schema } from "@/graphql/schema";

export const { getClient, query, PreloadQuery } = registerApolloClient(
  () =>
    new ApolloClient({
      cache: new InMemoryCache(),
      // A fresh resolver context per operation, exactly what Yoga gives each HTTP request.
      link: new SchemaLink({ schema, context: () => createContext() }),
    }),
);
