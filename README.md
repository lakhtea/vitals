# Vitals

<!-- After first push: swap <USER> for your GitHub handle -->
![CI](https://github.com/<USER>/vitals/actions/workflows/ci.yml/badge.svg)

A self-hostable real-user-monitoring (RUM) kit: a tiny browser library that
captures Core Web Vitals from real sessions, and a GraphQL analytics dashboard
to explore them. GraphQL end-to-end: code-first schema with Pothos, served by
GraphQL Yoga inside Next.js, consumed through Apollo Client's normalized
cache, persisted with Drizzle + SQLite.

**Live demo:** _(coming: demo mode is built and verified locally; the deploy
needs the owner's Vercel account, see docs/NEEDS-LAKHTE.md)_

## Why this exists

Most teams meet Core Web Vitals for the first time inside a Lighthouse score,
which is a lab number. What users actually experience — LCP on a cold cache in
the subway, INP on a six-year-old Android — only shows up in field data.
Hosted RUM products solve this but are heavy, paid, and opaque. Vitals is the
small, readable version: one script tag's worth of collection, an ingest
endpoint, and a dashboard that answers the three questions that matter —
what's slow, where, and for whom.

It is also a deliberate tour through the full GraphQL arc (schema design,
resolvers, the N+1 problem and DataLoader, cache normalization) and through
frontend performance engineering practiced on itself: the dashboard is
instrumented with its own library, and its own numbers are public.

## Architecture

```
your site ── vitals (browser lib: web-vitals + PerformanceObserver)
                 │  sendBeacon batches
                 ▼
        /api/collect (validation, ingest)
                 │
SQLite ── Drizzle ORM ── Pothos (code-first schema) ── GraphQL Yoga
                                                          │  /api/graphql
Next.js (App Router) ─────────── Apollo Client (normalized cache) ── dashboard
```

## Decisions

_Each decision gets a short write-up as it's made; the format is
problem → options → choice → tradeoff._

### GraphQL Yoga over Apollo Server
Apollo Server still leads raw downloads (~2M/wk vs ~800K/wk in 2026) but is
increasingly oriented toward its managed/federation ecosystem; Yoga is
framework-agnostic, lighter, and the common recommendation for new projects.
The transferable skills — schema design, resolvers, DataLoader — are identical
(same graphql-js core), and Apollo expertise still shows up here where Apollo
actually dominates: the client. Tradeoff accepted: fewer JD keyword matches on
the server layer, deliberately offset by Apollo Client on the front.

### Pothos (code-first) over SDL-first
Full TypeScript inference from resolver to schema with zero codegen for the
server layer. Tradeoff: SDL-first reads more portably in reviews; mitigated by
committing a generated [`schema.graphql`](./schema.graphql) snapshot that a
unit test and a CI step keep in lock-step with the code.

### Non-null by default in the schema
Pothos v4 defaults every field to nullable. The first typed client query
surfaced it: `Site.pages` was `[Page!]` and `name` was `String`, so every
read needed a null check. Options: annotate `nullable: false` on every
field (noisy, forgettable), accept nullable everywhere (pushes defensive
code into every component), or flip the builder default. Choice: builder
default `defaultFieldNullability: false`; fields opt into null explicitly
(`site(id:)` for an unknown id). Tradeoff: a resolver that returns
`undefined` by mistake now produces a GraphQL error rather than a quiet
null, which is the behaviour we want in a dashboard that must not lie.

### Typed documents (codegen `client` preset) over generated hooks
Client operations need types that cannot drift from the schema. Options:
hand-written result interfaces (what the skeleton had; drifts silently),
generated React hooks per operation (`useSitesWithPagesQuery`; couples every
component to Apollo's hook API and bloats with one hook per operation), or
the `client` preset's `graphql()` function returning a `TypedDocumentNode`
that any client (Apollo today, RSC fetches in M7) infers from. Choice: typed
documents, fragment masking off. Tradeoff: the generated module must be
committed and regenerated (`npm run codegen`), which is why
`codegen:check` runs in CI and a test pins `schema.graphql`.

### SQLite + Drizzle
Single-tenant, demo-scale collector → zero-ops local file DB, trivially
seedable with synthetic traffic and `:memory:` in tests. Tradeoff: no
Postgres/ClickHouse story for real event volume; acknowledged openly — this is
a kit, not a SaaS.

### drizzle-kit migrations over inline `CREATE TABLE IF NOT EXISTS`
The skeleton created tables inline, which works until the second version of
a table: `IF NOT EXISTS` never alters an existing one. Options: keep inline
DDL and hand-write `ALTER`s; `drizzle-kit push` (diffs straight into the
database, no history); generated migrations applied at startup. Choice:
generated migrations in `drizzle/`, applied by `migrate()` whenever a
database is opened, including `:memory:` in tests. Tradeoff: the migrations
folder must ship with the app (a packaging detail for M10), and every schema
change is two committed artifacts (SQL + snapshot) instead of one.

### Sender-chosen ids + `ON CONFLICT DO NOTHING` for idempotency
Both the seed and (from M2) the ingest endpoint must be safe to run twice.
Options: "skip if the table is not empty" (seed only, cannot coexist with
real data); server-side lookup-then-insert (racy, two round trips); let the
sender mint session/pageview ids and rely on a unique index for events.
Choice: the last. Tradeoff: the server trusts the sender's ids within a
site, which is acceptable because v1 has no auth boundary to protect, and it
is exactly how `web-vitals` expects `metric.id` to be used.

### Thresholds imported from `web-vitals`, never hand-copied
The good / needs-improvement / poor cut-offs are published by web.dev and
shipped as constants by the `web-vitals` package. Importing them keeps the
dashboard's ratings identical to the library's and makes a threshold change
a dependency bump, not a code audit. Tradeoff: a browser-oriented package is
now a server dependency; its threshold modules are pure constants and were
verified to import cleanly in Node.

### Collect endpoint: text body, open CORS, one pageview per batch
`sendBeacon` only avoids a CORS preflight (and survives `pagehide` on every
browser) when the body is a plain string, i.e. `text/plain`. Options: require
`application/json` (cleaner, breaks the beacon path), accept any content type
and parse the text (what every RUM vendor does), or add a proxy layer. Choice:
parse text, answer `OPTIONS`, allow any origin. Batches are one pageview, not
one session, so SPAs flush per navigation and a closed tab loses at most one
page. Tradeoff: no origin allow-list and no auth; `siteId` identifies but
does not authenticate, consistent with the no-multi-tenant scope. Rating is
recomputed server-side so stored ratings always match the dashboard's
thresholds.

### DataLoader for `Page.metrics` rather than aggregating at the root
Problem: `site { pages { metrics } }` ran one percentile statement per page
(measured: 12 for 10 pages). Options: (a) have the `pages` resolver compute
metrics for every page up front and attach them, which couples the parent
to a child field it cannot know was requested; (b) one hand-written root
SQL that returns pages with their metrics in a single statement, which is
genuinely the fastest option here; (c) keep resolvers independent and batch
with DataLoader via `@pothos/plugin-dataloader`. Choice: (c), measured at 3
statements. Tradeoff, stated plainly: for this exact query, (b) would be 1
statement and simpler SQL. DataLoader was chosen because it generalises to
every relation in the graph without the root knowing the shape of the
query, it composes when a client asks for `pages { metrics }` and
`sessions { pageviews }` in one document, and the per-request batching and
memoisation pattern is the transferable skill this repo exists to
demonstrate. The percentile SQL still accepts many sites and paths, so the
batch is one statement per distinct time range, not per page.

### One `TrafficFilter` input, windowed on pageview start
Every traffic field (`pages`, `metrics`, `sessions`) takes the same optional
`TrafficFilter { from, to, deviceClass, connectionType }` instead of four
loose arguments each, so a client declares one variable and passes it
everywhere. The time window is half-open and applies to when the navigation
started (session start for session lists), not to when each metric was
recorded. Options considered: window on `recordedAt` (an LCP recorded two
seconds after midnight would belong to a different day than its pageview;
the pages list and the metrics would disagree for narrow windows). Tradeoff:
the `(name, recorded_at)` index is now less useful; revisit with the M8
stress seed.

### CSS Modules and hand-rolled SVG, no UI or chart library
Problem: five dashboard components need consistent styling and one chart.
Options: a component library (fast, but hides the work this repo exists to
show and adds a large dependency), vanilla-extract (typed styles, extra
build step), CSS Modules (zero config in Next.js, scoped by default), and
for charts Recharts/visx versus inline SVG. Choice: CSS Modules with a tiny
token set in `globals.css`, and an inline SVG `TimeSeriesChart` whose
scaling math is a pure module. Tradeoff: more hand-written CSS and no
tooltips or zoom out of the box; acceptable for a kit whose charts answer
one question each.

### Storybook interaction tests via `@storybook/addon-vitest`
PLAN.md named `@storybook/test-runner`. Since Storybook 9 the recommended
path is the Vitest addon: stories become Vitest tests, run in real Chromium
through Vitest browser mode, with the a11y addon's violations as failures.
Choice: addon-vitest as a second Vitest project (`npm run test:storybook`)
so the unit loop never needs a browser. Tradeoff: one more moving part in
`vitest.config.mts`; in exchange CI reuses the Playwright Chromium already
installed for e2e.

### Hosting: Vercel with an ephemeral, seeded SQLite per cold start
The dashboard is single-tenant and its database is one SQLite file, which no
serverless host keeps between invocations. Options: a host with a disk (a
Fly.io volume, a VPS), which persists data but adds a machine to run, patch,
and pay for; libSQL/Turso, which keeps the SQL but swaps the embedded
synchronous driver for a network one, so every `.get()`/`.run()` in the query
layer becomes an `await` and the demo depends on a second vendor; or Vercel
with a "demo mode" that opens the database in the function's temp dir,
migrates and seeds it on first open, and accepts that it vanishes with the
instance. Choice: Vercel plus demo mode behind one env var,
`VITALS_DEMO_MODE=1`, which also hides GraphiQL and rate-caps `/api/collect`
(120 batches per minute per site, in memory, 429 with `retry-after`).
Self-hosters are untouched: the switch only changes where the file lives and
whether it is seeded. Tradeoff: the public demo forgets everything on a cold
start, and concurrent warm instances each hold their own copy, so a beacon
sent to one instance may not appear in a dashboard served by another; the
self-measurement panel therefore demonstrates the loop, not durable history.

### Hand-rolled fixed-row-height windowing over @tanstack/react-virtual
Problem: 2,000 session rows put 2,001 `<tr>` in the DOM (measured) for a
viewport that shows fourteen. Options: TanStack Virtual (measured, variable
row heights, scroll-to-index, ~5 KB gzip into the very bundle the new budget
guards), or a window computed from the scroll offset over rows pinned to one
height. Choice: hand-rolled. The table is five single-line, ellipsised cells,
so a fixed 36 px row is already the design; the whole mechanism is one pure
function (`rowWindow.ts`, unit-tested), two spacer rows that keep the
scrollbar honest, `aria-rowcount`/`aria-rowindex` so screen readers hear the
true total, and a sticky header inside the same `<table>`, which keeps axe
green. Tradeoff: row height is a hard constraint (no wrapping cells), there is
no scroll-to-row API, and find-in-page sees only rendered rows; if a table
with variable heights arrives, TanStack is the upgrade path, not a rewrite.

### Integer epoch-millisecond timestamps
SQLite has no date type. Options: ISO 8601 text (readable, slower to
compare, 24 bytes), Unix seconds (loses sub-second precision the browser
has), epoch milliseconds (what `Date.now()` and `performance.timeOrigin`
already produce). Choice: epoch ms in integer columns; GraphQL exposes ISO
strings for humans. Tradeoff: raw rows are not human-readable in the sqlite3
CLI without `datetime(col/1000, 'unixepoch')`.

### Awaited server data as props over `PreloadQuery` streaming
Problem: the first paint must be rendered on the server with real data, the
HTML must carry it even with JavaScript disabled (the M7 proof), and
hydration must not refetch it. Options: (a) have the Server Component fetch
the app's own `/api/graphql` (an HTTP round trip to itself: absolute URL, a
listening port, the result serialised twice); (b) `PreloadQuery` +
`useSuspenseQuery` from `@apollo/client-integration-nextjs`, which streams
the result into the client cache behind a `<Suspense>` boundary. React
outlines any completed boundary over ~12.8 KB behind an inline script, so a
visitor without JavaScript sees the fallback forever (measured: the first
table row sat inside `<div hidden id="S:0">` with an explicit boundary and
again with a route-level `loading.tsx`); (c) `await query()` through a
`SchemaLink` client in the Server Component and pass the resolved result as
props; the client view renders those props first and runs `useQuery` only
for a changed site or filter. Choice: (c). The same typed document,
resolvers, DataLoaders, and `createContext()` serve HTTP and RSC with no
network hop, the HTML is complete, and hydration sends zero requests
(`skip` while the view is the initial one). Tradeoff: the first result is
props and later ones live in the Apollo cache, so returning to the default
filters shows the server-time snapshot rather than a refetch, and the page
is one shell rather than streamed sections. `PreloadQuery` stays exported
from `src/app/apollo/rsc-client.ts` for per-section streaming where a
fallback is acceptable.

## Server/client boundary

The overview is a Server Component tree with `"use client"` only at the
leaves that need interaction. Everything a client file imports ships to the
browser, so the line is drawn as low as possible.

| File | Runs | Why |
| ---- | ---- | --- |
| `src/app/layout.tsx` | server | HTML shell; renders `ApolloWrapper` around `{children}` |
| `src/app/page.tsx` | server | reads the site list and the first `Dashboard` result in-process; takes the one clock reading (`asOf`) |
| `src/app/apollo/rsc-client.ts` | server | per-request Apollo Client over `SchemaLink`; `import "server-only"` makes a client import a build error |
| `src/app/apollo/ApolloWrapper.tsx` | client | React context is client-only; the single provider |
| `src/dashboard/components/DashboardView.tsx` | client | owns site and filter state; `useQuery` for anything but the initial view |
| `src/dashboard/components/FilterBar.tsx` | client | `onChange` handlers |
| `src/dashboard/components/PagesTable.tsx` | client | sort order is local UI state |
| `src/dashboard/components/SessionsTable.tsx` | client | the row window follows the scroll position |
| `MetricCard`, `DashboardHeader` | either | props in, markup out; today they render inside `DashboardView` |

First paint: `page.tsx` -> `query()` -> `SchemaLink` -> Pothos resolvers ->
SQLite, all in one process, with no HTTP request to `/api/graphql`. The
resolved result reaches `DashboardView` as props, so the server HTML and the
hydrated tree are identical and hydration sends nothing. Later site and
filter changes are ordinary client requests to `/api/graphql` through
`useQuery`; the previous cards and tables stay on screen while the next
result loads. There is deliberately no `<Suspense>` or `loading.tsx` around
this page: React outlines any completed boundary over ~12.8 KB behind an
inline script, which hides the tables from a visitor without JavaScript.
`e2e/ssr.spec.ts` loads the page with JavaScript disabled and asserts the
seeded rows are visible; that test is what makes the server-rendering claim
checkable. Dates render in UTC (`src/dashboard/dates.ts`) for the same
reason: the server and the viewer rarely share a time zone, and a mismatch
would make React throw the server HTML away.

## Metrics (measured here, on this repo — never estimated)

| What | Before | After |
| ---- | ------ | ----- |
| `site { pages { metrics } }` SQL statements, N = 10 seeded pages ([method](./scripts/measure-query-count.ts), [pinned by test](./src/graphql/metrics.test.ts)) | 12 = 2 + N (naive) | 3 (DataLoader) |
| `site { sessions(limit: 20) { pageviews } }` SQL statements ([method](./scripts/measure-query-count.ts), [pinned by test](./src/graphql/metrics.test.ts)) | not measured (built batched from the start) | 3 (DataLoader) |
| Sessions table with 2,000 rows: `<tr>` in the DOM / median time to first row, 5 runs ([method](./scripts/measure-render.ts), `npm run build-storybook && npm run measure:render`) | 2,001 / 155 ms | 26 / 91 ms (windowed) |
| First Load JS for `/`, raw bytes, JS only ([method](./scripts/check-bundle-budget.ts), `npm run build && npm run measure:bundle`) | 689,831 B (about 200 KB gzip) | CI fails above +10% ([baseline](./bundle-budget.json)) |
| Stress seed: 2,000 sessions / 21,265 pageviews / 100,136 events (`npm run db:seed:stress`) | — | 0.8 s to insert, idempotent on rerun |
| This dashboard's own p75 LCP / CLS / INP | — | TBD (needs the M3 library) |

## Collecting data: `POST /api/collect`

One request carries one pageview's worth of metrics. Send it with
`navigator.sendBeacon` (as a plain string, so no CORS preflight) or
`fetch(..., { keepalive: true })`. No content-type is required.

```json
{
  "siteId": "demo",
  "session": {
    "id": "6f1c…",            "startedAt": 1759838400000,
    "deviceClass": "mobile",  "connectionType": "4g",
    "userAgentFamily": "Chrome"
  },
  "pageview": { "id": "9a2e…", "path": "/pricing", "startedAt": 1759838400000 },
  "events": [
    { "id": "v4-1759838400000-1", "name": "LCP", "value": 2612.4, "recordedAt": 1759838402612 },
    { "id": "v4-1759838400000-2", "name": "CLS", "value": 0.03,   "recordedAt": 1759838409000 },
    { "id": "v4-1759838400000-3", "name": "INP", "value": 184,    "recordedAt": 1759838415000 }
  ]
}
```

| Status | `error.code` | Meaning |
| ------ | ------------ | ------- |
| 202 | | Stored. Body: `{ "inserted": n, "duplicates": d }`. Delivering the same batch again is safe. |
| 400 | `invalid_json` | Body is not JSON. |
| 422 | `invalid_payload` | Shape, enum, or range violation; `error.issues[].path` names the field (e.g. `events.0.value`). |
| 413 | `batch_too_large` / `payload_too_large` | More than 25 events, or more than 64 KB. |
| 404 | `unknown_site` | `siteId` is not configured. |
| 429 | `rate_limited` | Demo mode only: more than 120 batches per minute for one site; honour `retry-after`. |

Ids for the session, pageview, and each event are chosen by the sender
(`web-vitals` provides `metric.id`); the server dedupes on them, which is
what makes retries and double flushes harmless. Ratings are recomputed
server-side from the value. Full reasoning in
[docs/learning/02-ingestion.md](./docs/learning/02-ingestion.md).

## Development

```bash
npm install
npm run db:seed   # synthetic demo traffic (idempotent)
npm run dev       # http://localhost:3000 · GraphiQL at /api/graphql

npm run test      # unit tests (Vitest, in-memory SQLite)
npm run test:e2e  # Playwright, end-to-end paths
npm run typecheck && npm run lint

npm run db:generate   # after editing src/db/schema.ts: writes the next migration
npm run codegen       # after changing the schema or a client query: schema.graphql + typed documents
```

The database lives at `.data/vitals.db` (override with `VITALS_DB_PATH`).

## Scope (v1 guardrails)

Core Web Vitals (LCP, CLS, INP, TTFB, FCP) by page, device class, and
connection; a session view; percentile aggregates (p75 first, per web.dev
thresholds). **Deliberately excluded:** error tracking, session replay, alerts,
multi-tenant auth, sampling strategies beyond a simple rate. Ship small,
polished, instrumented with itself.

## Docs

- [docs/TOUR.md](./docs/TOUR.md) - the ten-minute codebase tour
- [docs/learning/](./docs/learning/) - one teaching chapter per milestone, plus the glossary
- [TESTING_RULES.md](./TESTING_RULES.md) - how we decide what deserves a test
- [docs/NEEDS-LAKHTE.md](./docs/NEEDS-LAKHTE.md) - everything that needs the owner's accounts or sign-off

## Roadmap

See [PLAN.md](./PLAN.md) — the working milestone plan this repo is built from.
