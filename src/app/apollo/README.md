# Apollo in the App Router

Two clients, two worlds, never mixed.

- `rsc-client.ts` is for Server Components only.
  It runs queries in-process through `SchemaLink`, so no HTTP hop to our own server; `import "server-only"` makes a Client Component import a build error.
- `make-client.ts` + `ApolloWrapper.tsx` are for Client Components.
  In the browser the link posts to `/api/graphql`; in the SSR pass it dials `http://localhost:$PORT` behind `SSRMultipartLink`.

## How a page fetches

1. Default (what `src/app/page.tsx` does): `const { data } = await query({ query: DOC, variables })` in the Server Component, after `await connection()` so the page is never prerendered at build time, then pass the result as props to the `"use client"` view.
   The HTML is complete without JavaScript and hydration sends nothing; the view calls `useQuery(DOC, { variables, skip })` only once the user changes something, keeping the previous result on screen while the next loads.
2. Per-section streaming: `<PreloadQuery query={DOC} variables={...}>` around a `<Suspense>` boundary whose client child calls `useSuspenseQuery(DOC, { variables })` with the same document and variables.
   Use it only where a fallback is acceptable: React ships any completed boundary over ~12.8 KB as a hidden chunk plus an inline script, so that content is invisible without JavaScript.
3. Never hand server data to a component that also runs the same query client-side; the two caches drift apart.

## Keeping the client boundary small

`ApolloWrapper` is the only file in this folder that says `"use client"`, and `layout.tsx` renders it around `{children}` so the page itself stays a Server Component.
Add `"use client"` to the leaf that needs hooks, state, or events, not to the page that contains it, and pass Server Component output through `children` where possible.
