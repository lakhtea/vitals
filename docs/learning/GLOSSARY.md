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
A per-request utility that collects every `load(id)` call made during one tick of the event loop and issues a single batched fetch for all of them.
It also memoises, so the same id is fetched once per request.

**Context.**
The object every resolver receives as its third argument.
Here it carries the database handle, which is how tests swap in an in-memory database.

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
