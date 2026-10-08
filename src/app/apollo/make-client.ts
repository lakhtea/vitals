// Builds the Apollo Client that Client Components share, both in the browser
// and during the streaming-SSR pass. Server Components never use it; they get
// a per-request client from ./rsc-client.ts instead.
import { ApolloLink, HttpLink } from "@apollo/client";
import { ApolloClient, InMemoryCache, SSRMultipartLink } from "@apollo/client-integration-nextjs";

const GRAPHQL_PATH = "/api/graphql";
// `next dev` and `next start` export the port they bound to as PORT; 3000 is their default.
const DEFAULT_NEXT_PORT = "3000";

const isBrowser = (): boolean => typeof window !== "undefined";

// The browser resolves a relative path against the page's origin. Node's fetch
// has no origin, so the SSR pass must dial the local server by absolute URL.
const resolveGraphqlUri = (): string => {
  if (isBrowser()) {
    return GRAPHQL_PATH;
  }
  const port = process.env.PORT ?? DEFAULT_NEXT_PORT;
  return `http://localhost:${port}${GRAPHQL_PATH}`;
};

const makeLink = (): ApolloLink => {
  const httpLink = new HttpLink({ uri: resolveGraphqlUri() });
  if (isBrowser()) {
    return httpLink;
  }
  // Static HTML cannot carry a multipart (@defer) response, so the SSR pass
  // strips @defer fragments and waits for one complete payload instead.
  return ApolloLink.from([new SSRMultipartLink({ stripDefer: true }), httpLink]);
};

export const makeClient = (): ApolloClient =>
  new ApolloClient({
    cache: new InMemoryCache(),
    link: makeLink(),
  });
