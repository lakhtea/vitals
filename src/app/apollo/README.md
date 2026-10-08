# Apollo in the App Router

Two clients, two worlds, never mixed.

- `rsc-client.ts` is for Server Components only.
  It runs queries in-process through `SchemaLink`, so no HTTP hop to our own server; `import "server-only"` makes a Client Component import a build error.
- `make-client.ts` + `ApolloWrapper.tsx` are for Client Components.
  In the browser the link posts to `/api/graphql`; in the SSR pass it dials `http://localhost:$PORT` behind `SSRMultipartLink`.

## How a page fetches

1. Preferred: in the Server Component page, wrap the interactive child in `<PreloadQuery query={DOC} variables={...}>` from `rsc-client.ts`, and in the `"use client"` child call `useSuspenseQuery(DOC, { variables })` with the same document and variables.
   The data is fetched once on the server, streamed into the client cache, and the child never refetches on hydration.
   Put the `<Suspense>` boundary around the child with a fallback shaped like the final layout.
2. Server-only data (no interaction below it): `const { data } = await query({ query: DOC })` and render it directly.
   Never hand that data to a component that also runs the same query client-side; the README of the integration package warns the two caches drift apart.

## Keeping the client boundary small

`ApolloWrapper` is the only file in this folder that says `"use client"`, and `layout.tsx` renders it around `{children}` so the page itself stays a Server Component.
Add `"use client"` to the leaf that needs hooks, state, or events, not to the page that contains it, and pass Server Component output through `children` where possible.
