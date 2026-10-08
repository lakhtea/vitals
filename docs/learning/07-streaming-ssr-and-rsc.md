# 07 - Streaming SSR and React Server Components

> Milestone 7 moves the dashboard's first paint to the server.
> The sections on how the technology works are written first; the "what was built" and file list are filled in when the integration lands.

## Rendering, from first principles

A React app can produce HTML in three places, and the dashboard has now used all three.

**Client-side rendering (M1 to M6).**
The server sends an almost empty HTML shell plus JavaScript.
The browser downloads the bundle, runs it, calls `useQuery`, waits for `/api/graphql`, and only then paints the table.
Time to first content is bounded by the slowest of download, parse, execute, and fetch, in series.
With JavaScript disabled the page is blank.

**Server-side rendering (SSR).**
The server runs the components, produces full HTML, and sends it.
The browser paints immediately, then downloads the bundle and *hydrates*: React walks the existing DOM, attaches event handlers, and takes over.
First paint is fast; interactivity arrives when hydration finishes.
The catch in a classic SSR setup is that the whole page waits for the slowest data before any byte is sent.

**Streaming SSR with Suspense.**
The server sends the HTML shell as soon as it exists and streams each `<Suspense>` boundary's content when its data resolves, as additional chunks on the same response.
The browser paints the shell, then the slow parts fill in without a round trip.
React 18 made this possible; the App Router makes it the default.

## What a React Server Component is

A Server Component runs only on the server and ships no JavaScript to the browser.
It can be `async`, read the database directly, and return JSX.
Its output is serialised as the RSC payload, a compact description of the UI tree, which the client runtime turns into DOM and which also drives client-side navigations.

A Client Component is marked with `"use client"` at the top of its file.
It is rendered on the server too (for the initial HTML), then hydrated and run in the browser, where it may use state, effects, and browser APIs.
Everything a Client Component imports becomes part of the browser bundle.

The rule for where to draw the line: a component is a Client Component only if it needs interaction or browser state.
`FilterBar` needs `onChange`; `PagesTable` sorts on click; those are client.
`MetricCard` and `SessionsTable` take props and render; those can stay server.
A page should be a Server Component that renders Client Components at the leaves, not a Client Component at the root that drags everything into the bundle, which is exactly what `page.tsx` has been since M1.

## What hydration is, precisely

Hydration is React matching its virtual tree against DOM that already exists.
It does not re-create elements; it attaches event handlers and takes ownership of state.
It requires the server and client to render the same tree for the same props, which is why a `Date.now()` evaluated during render produces a hydration mismatch: the server's "now" and the client's differ.
The dashboard computes its time window outside render for that reason.

A page with a hydration error still works, but React discards the server HTML and re-renders from scratch, which costs the paint you were trying to save and often ships a layout shift.
This app measures layout shift for a living; it must not cause one.

## Where Apollo fits

Apollo Client is a client-side cache.
On the server there is no browser, no persistent cache, and the "client" for one request must not leak into another.
The Next.js integration package solves three problems:

1. A per-request Apollo Client for Server Components, created lazily and memoised with React's `cache()` so one request shares one instance.
2. A browser client whose cache is pre-filled with whatever the server already fetched, so hydration does not refetch.
3. During streaming SSR, Client Components that call `useSuspenseQuery` have their data pushed from the server into the browser cache chunk by chunk, so each Suspense boundary resolves without a network request.

The server-side client here uses a `SchemaLink`: it executes the GraphQL document directly against the Pothos schema in the same process, with the same `createContext()` the HTTP endpoint uses.
No HTTP hop to itself, no port, no serialisation round trip; the first paint reads SQLite and renders.

## Why the no-JavaScript test proves the claim

An e2e test opens the overview with JavaScript disabled and asserts that the HTML already contains the seeded aggregates.
With JavaScript off there is no hydration and no `useQuery`; whatever appears was rendered on the server.
It is the only test that cannot be fooled by a client component that happens to fetch quickly.

## Suspense loading UI that does not shift

A `loading.tsx` or `<Suspense fallback>` renders while a boundary's data is pending.
If the fallback has a different height than the content, the page shifts when the data arrives, and CLS is charged.
The fallbacks here reserve the same box: metric cards render as empty cards of fixed height, tables render their header row and a fixed number of placeholder rows.

## Self-check

1. Why can a Server Component be `async` but a Client Component cannot?
2. Where does the time window's "now" get computed, and why there?
3. What exactly does the browser receive for a Server Component: HTML, JavaScript, both, or something else?
4. What would happen to the e2e no-JS test if `page.tsx` kept `"use client"` at the top?
5. Why does the server-side Apollo client use a SchemaLink rather than fetching `/api/graphql`?

<details>
<summary>Answers</summary>

1. Server Components render once per request on the server, so awaiting inside them is just waiting before sending; Client Components re-render and must be synchronous functions of props and state, with async work in effects or Suspense-aware hooks.
2. Outside render, on the server for the initial request and in an event handler or memo keyed on user input on the client; computing it inside render makes server and client disagree and causes a hydration mismatch.
3. HTML for the initial paint plus the RSC payload describing the tree; no JavaScript for the Server Component itself, only for the Client Components it renders.
4. The test would fail: with JavaScript disabled nothing would run `useQuery`, so the HTML would contain only the loading state.
5. The server already has the schema and the database in-process; executing directly avoids an HTTP round trip to itself, works before the server is listening, and shares the exact resolvers and context the endpoint uses.

</details>
