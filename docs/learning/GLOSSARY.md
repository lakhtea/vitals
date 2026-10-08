# Glossary

> Two or three sentences per term.
> Chapters link here instead of re-explaining.
> Add a term the first time it appears in a chapter.

## GraphQL

**GraphQL.**
A query language and execution engine for APIs.
The client sends a tree-shaped document naming exactly the fields it wants, and the server resolves each field with a function.

**Schema.**
The typed description of every object type, field, query, and mutation a GraphQL server can serve.
Clients are validated against it before any resolver runs.

**Resolver.**
A function `(parent, args, context, info)` that produces the value of one field.
List fields cause the child resolvers to run once per item, which is where the N+1 problem comes from.

**Code-first vs SDL-first.**
SDL-first writes the schema in GraphQL's own language and attaches resolvers separately.
Code-first writes TypeScript that constructs the schema, so the compiler checks resolvers against field types.
This repo is code-first with Pothos.

**Pothos.**
A code-first schema builder for TypeScript.
Types are declared through a builder object, and `builder.toSchema()` emits a standard graphql-js schema.

**GraphQL Yoga.**
A GraphQL HTTP server built on the Fetch API.
It parses, validates, and executes requests, serves GraphiQL, and plugs directly into Next.js route handlers.

**GraphiQL.**
The in-browser GraphQL IDE, served at `GET /api/graphql`.
It reads the schema for autocomplete and lets you run queries by hand.

**Apollo Client.**
The GraphQL client used in the browser.
It fetches, caches, and keeps React components in sync with query results.

**Normalized cache.**
Apollo splits each object with an `id` and `__typename` into its own cache record keyed by `Typename:id`, and stores query results as references.
Two queries that return the same object share one record, so an update to it re-renders both.

**N+1 problem.**
Fetching a list of N parents and then issuing one query per parent for a child field, for N+1 queries total.
The standard fix is DataLoader.

**DataLoader.**
A per-request utility that collects every `load(key)` call made during one tick of the event loop and issues a single batched fetch for all of them.
It also memoises, so the same key is fetched once per request.
Its one contract: the batch function returns values in the same order as the keys it received.

**Batching window (tick).**
The moment DataLoader waits for before firing its batch: after the current synchronous work and the promise jobs queued behind it.
Every resolver graphql-js calls for a list's items runs inside that window, which is why all their keys land in one batch.

**Memoisation.**
Remembering the result for a key so a second request for it returns the same promise instead of fetching again.
DataLoader does this per request; the `cacheKeyFn` option says how to turn an object key into a string for the lookup.

**Custom scalar.**
A GraphQL leaf type you define, with `serialize` (value to wire), `parseValue` (variable to value), and `parseLiteral` (inline literal to value).
`DateTime` here carries epoch milliseconds as ISO 8601 strings because GraphQL `Int` is 32-bit.

**Window function.**
A SQL function evaluated over a "window" of related rows without collapsing them, such as `ROW_NUMBER() OVER (PARTITION BY path ORDER BY value)`.
The percentile query ranks every value within its (site, path, metric) group this way.

**Nearest-rank percentile.**
The p-th percentile defined as the value at rank ceil(p x n) in the sorted sample.
Simple, exact for small samples, and what this repo uses; CrUX uses histogram interpolation instead.

**Half-open interval.**
A range that includes its start and excludes its end, written [from, to).
Time filters use it on the pageview's start time so adjacent ranges never double count a navigation.

**Context.**
The object every resolver receives as its third argument.
Here it carries the database handle, which is how tests swap in an in-memory database.

**SDL (Schema Definition Language).**
GraphQL's own text syntax for schemas (`type Site { id: ID! }`).
Pothos builds the schema in TypeScript and `schema.graphql` is its printed SDL.

**Schema snapshot.**
The committed `schema.graphql`, generated from the running schema and sorted for stable diffs.
It is the reviewable contract: a schema change shows up as a diff in it, and a test fails if it is stale.

**GraphQL Codegen.**
A tool that reads a schema and the client's operations and generates TypeScript from them.
The `client` preset here emits a `graphql()` function whose return type is a `TypedDocumentNode`.

**TypedDocumentNode.**
A GraphQL document object that carries its result and variable types as TypeScript generics.
Apollo's `useQuery` reads them, so `data.sites[0].pages` is typed without any annotation.

**Fragment masking.**
A codegen option where each component only sees the fields its own fragment asked for.
Off in this repo to keep generated types plain.

## Database

**ORM / query builder.**
A library that maps between application code and SQL.
Drizzle is a thin typed query builder rather than a heavy object-relational mapper.

**Drizzle.**
The TypeScript query builder used here.
Tables are declared in TypeScript once, and both the SQL and the row types come from that declaration.

**SQLite.**
An embedded SQL database stored in a single file, running inside the application process.
No server, no network, trivially copied and seeded.

**better-sqlite3.**
A synchronous native Node binding to SQLite.
Synchronous is appropriate because the database is in-process; there is no network latency to hide.

**WAL (write-ahead log).**
A SQLite journaling mode where writes append to a log and readers keep reading the main file.
It lets reads and a write overlap.

**Migration.**
A versioned script that moves a database schema from one shape to the next.
This repo currently bootstraps tables inline with `CREATE TABLE IF NOT EXISTS`; drizzle-kit migrations are the planned replacement once the schema settles.

**Seed.**
A script that inserts synthetic rows so the app has data to show.
Ours is idempotent.

**Idempotent.**
An operation that produces the same end state whether it runs once or many times.
Re-running the seed must not duplicate rows; retrying an ingest request must not double-count an event.

**ON CONFLICT DO NOTHING.**
An insert clause that silently skips a row whose primary key or unique index already exists.
Combined with ids chosen by the sender, it is how both the seed and the ingest endpoint stay idempotent.

**Foreign key.**
A column that must match a primary key in another table, such as `pageviews.session_id` -> `sessions.id`.
SQLite only enforces them when `PRAGMA foreign_keys = ON` is set per connection.

**Index.**
A sorted lookup structure on one or more columns that makes filtering and grouping on them fast.
A unique index additionally forbids two rows with the same values, which is how the metric-event dedupe key is enforced.

**Transaction.**
A group of statements that either all apply or none do.
The seed wraps its inserts in one so a crash halfway cannot leave a partially seeded database.

**drizzle-kit.**
Drizzle's command-line tool.
`npm run db:generate` diffs `src/db/schema.ts` against the last snapshot in `drizzle/meta/` and writes the SQL that moves the database forward.

**Snapshot (drizzle-kit).**
A JSON description of the schema at the time a migration was generated, stored in `drizzle/meta/`.
The next generate run diffs the current schema against it, so it must be committed with its migration.

**Aggregate.**
A value computed over many rows, such as a count or a percentile per path.
GraphQL types like `Page` are aggregates rather than stored rows, which is why they have no `id`.

## Ingestion

**sendBeacon.**
`navigator.sendBeacon(url, data)` asks the browser to deliver a small POST on the page's behalf and returns immediately, with no response.
It is the reliable way to send data while a page is unloading.

**keepalive fetch.**
`fetch(url, { keepalive: true })` is a request allowed to outlive the page, like a beacon but with a readable response.
The browser library's fallback when `sendBeacon` is unavailable or refuses the payload.

**CORS preflight.**
An `OPTIONS` request the browser sends before a cross-origin request that is not "simple" (for example one with `Content-Type: application/json`).
Beacons sent as plain text avoid it, which is why the collect endpoint does not require a JSON content type.

**pagehide / visibilitychange.**
The two browser events that signal a page is going away or being hidden.
The library flushes on both because browsers disagree about which fires reliably, which is one reason delivery must be idempotent.

**bfcache (back/forward cache).**
The browser keeping a whole page alive in memory so Back is instant.
A restored page reports its metrics again with new `web-vitals` ids.

**Trust boundary.**
The line where data from outside the system enters code that assumes it is well formed.
`POST /api/collect` is this repo's main one, and every rule in `src/collect/payload.ts` exists to hold it.

**Zod.**
A TypeScript-first runtime validation library.
A schema both checks data at runtime and produces the static type, so a valid payload has exactly one definition.

## Performance

**Virtualisation (windowing).**
Rendering only the rows that intersect the viewport plus a small overscan, inside a container sized as if every row were present.
Cuts DOM size from N rows to a few dozen; the price is fixed row heights and find-in-page seeing only rendered rows.

**First Load JS.**
The JavaScript a route needs before it is interactive, shared chunks included.
Next 16 no longer prints it, so `scripts/check-bundle-budget.ts` computes it from the build manifests.

**Bundle budget.**
A committed baseline for First Load JS plus a tolerance, enforced in CI.
It turns a number you glance at into a number you cannot regress by accident.

**aria-rowcount / aria-rowindex.**
ARIA attributes that tell assistive technology how many rows a table really has and which row this is, when the DOM holds only a window of them.

## Hosting

**Cold start.**
The first request served by a fresh serverless function instance, which must load code and, here, create and seed its database.
Demo mode is built around the fact that nothing survives from the previous instance.

**Serverless function instance.**
One running copy of the app on a platform like Vercel, created on demand and recycled when idle.
Several can run at once with no shared disk, which is why the demo's data is per instance.

**Output file tracing.**
The step where Next.js works out which files a route needs at runtime and copies only those into the deployable function.
Files read with `fs` rather than imported, like the `drizzle/` migrations, must be listed explicitly.

**Fixed-window rate limit.**
Allowing at most N requests per key within each clock window (120 per minute per site here), then refusing with 429 and a `retry-after` until the window turns over.
Simple, in memory, and enough to stop a loop from filling a demo instance's temp dir.

## Synthetic data

**PRNG (pseudo-random number generator).**
A function that produces a sequence that looks random but is fully determined by its seed number.
The seed uses one so the demo data is identical on every machine and every run.

**Log-normal distribution.**
A distribution whose logarithm is normally distributed, giving a cluster near the median and a long right tail.
Page timings in the field have this shape, so the seed samples timings from it.

**Mixture.**
Sampling from one of several distributions chosen by a weighted coin.
The seed's CLS is a mixture: mostly near zero, sometimes moderate, occasionally an outlier.

## Next.js and React

**App Router.**
The Next.js routing system based on the `src/app/` directory, where folders are URL segments and special files (`page.tsx`, `layout.tsx`, `route.ts`) define what renders there.

**Route handler.**
A `route.ts` file exporting functions named after HTTP methods (`GET`, `POST`).
Each receives a standard `Request` and returns a standard `Response`.

**Client component.**
A React component marked with `"use client"` that runs in the browser and may use state, effects, and browser APIs.
Apollo's hooks require it.

**React Server Component (RSC).**
A component that renders only on the server and ships no JavaScript to the browser.
The default in the App Router; covered in depth in M7.

**Hydration.**
The step where React attaches event handlers to server-rendered HTML so it becomes interactive.
Covered in depth in M7.

## UI

**CSS Modules.**
Stylesheets named `X.module.css` whose class names are rewritten to be unique per file at build time.
Styles cannot leak between components, and there is no runtime cost.

**Design token.**
A named CSS custom property (`--rating-good`, `--surface`) defined once on `:root` with a dark-mode override.
Components reference tokens, never raw colours, so themes change in one place.

**Controlled component.**
A component that owns no state: it renders the `value` it is given and calls `onChange` with the next value.
`FilterBar` is one, which is what makes it testable in isolation.

**Story.**
One named, rendered state of one component with fixed props, written in Component Story Format (CSF).
Storybook catalogues stories and the Vitest addon runs each one as a test.

**Play function.**
A script attached to a story that runs after it renders: query the DOM, interact with `userEvent`, assert.
The repo's interaction tests live here rather than in Playwright.

**axe.**
The accessibility rules engine (axe-core) that inspects rendered DOM for mechanically checkable WCAG failures.
Run per story by the a11y addon with violations as failures, and per page by Playwright in M9.

## Testing and tooling

**Vitest.**
The unit test runner.
Tests here execute the GraphQL schema in-process against a fresh in-memory SQLite database.

**Playwright.**
The browser automation library behind the e2e tests.
It boots the dev server, drives real Chromium, and asserts on what a user would see.

**E2E (end-to-end) test.**
A test that exercises the system the way a user does, from browser to database.
Slow and few, but the only kind that proves the whole chain.

**CI (continuous integration).**
GitHub Actions runs lint, typecheck, unit, and e2e on every push and pull request.
The commands are the same npm scripts used locally.

**Walking skeleton.**
The thinnest end-to-end slice of a system that actually runs.
You grow it feature by feature instead of building layers in isolation.

## Web performance

**RUM (real-user monitoring).**
Measuring performance from real visitors' browsers in the field, as opposed to lab tools like Lighthouse.
Field data captures what users actually experienced on their devices and networks.

**Core Web Vitals.**
Google's set of user-centric performance metrics.
The current three are LCP, CLS, and INP; TTFB and FCP are supporting diagnostics.

**LCP (Largest Contentful Paint).**
Milliseconds until the largest visible text block or image rendered.
Good is 2500 ms or less, poor is above 4000 ms.

**CLS (Cumulative Layout Shift).**
A unitless score of how much visible content moved unexpectedly during the page's life.
Good is 0.1 or less, poor is above 0.25.

**INP (Interaction to Next Paint).**
The latency, in milliseconds, of the slowest meaningful user interaction on the page (roughly the worst, ignoring outliers on very busy pages).
Good is 200 ms or less, poor is above 500 ms.
It replaced FID in 2024.

**FID (First Input Delay).**
The retired predecessor of INP.
It measured only the input delay of the first interaction, not the full interaction; this repo does not record it.

**TTFB (Time to First Byte).**
Milliseconds from navigation start until the first byte of the HTML response arrived.
Good is 800 ms or less, poor is above 1800 ms.

**FCP (First Contentful Paint).**
Milliseconds until any text or image first rendered.
Good is 1800 ms or less, poor is above 3000 ms.

**Rating thresholds.**
Each metric has two thresholds splitting values into good, needs-improvement, and poor.
This repo reads them from the `web-vitals` package rather than hard-coding them, so they track web.dev.

**p75 (75th percentile).**
The value that 75% of measured page loads were at or below.
web.dev uses p75 as the headline aggregate because it reflects most users while tolerating a tail of outliers.

**web-vitals (package).**
Google's small library that measures the Core Web Vitals in the browser using PerformanceObserver.
It is the single runtime dependency of the Vitals browser library.
