# Vitals

<!-- After first push: swap <USER> for your GitHub handle -->
![CI](https://github.com/<USER>/vitals/actions/workflows/ci.yml/badge.svg)

A self-hostable real-user-monitoring (RUM) kit: a tiny browser library that
captures Core Web Vitals from real sessions, and a GraphQL analytics dashboard
to explore them. GraphQL end-to-end: code-first schema with Pothos, served by
GraphQL Yoga inside Next.js, consumed through Apollo Client's normalized
cache, persisted with Drizzle + SQLite.

**Live demo:** _(coming — seeded synthetic traffic, plus the dashboard
measuring itself)_

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
committing a generated `schema.graphql` snapshot _(TODO)_.

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

### Integer epoch-millisecond timestamps
SQLite has no date type. Options: ISO 8601 text (readable, slower to
compare, 24 bytes), Unix seconds (loses sub-second precision the browser
has), epoch milliseconds (what `Date.now()` and `performance.timeOrigin`
already produce). Choice: epoch ms in integer columns; GraphQL exposes ISO
strings for humans. Tradeoff: raw rows are not human-readable in the sqlite3
CLI without `datetime(col/1000, 'unixepoch')`.

## Metrics (measured here, on this repo — never estimated)

| What | Before | After |
| ---- | ------ | ----- |
| `pages { metrics }` SQL queries over N pages | TBD (N+1) | TBD (DataLoader) |
| Sessions table render, stress seed | TBD | TBD (virtualized) |
| First-load JS, dashboard route | TBD | budget enforced in CI |
| This dashboard's own p75 LCP / CLS / INP | — | TBD (self-instrumented) |

## Development

```bash
npm install
npm run db:seed   # synthetic demo traffic (idempotent)
npm run dev       # http://localhost:3000 · GraphiQL at /api/graphql

npm run test      # unit tests (Vitest, in-memory SQLite)
npm run test:e2e  # Playwright, end-to-end paths
npm run typecheck && npm run lint

npm run db:generate   # after editing src/db/schema.ts: writes the next migration
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
