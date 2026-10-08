# The ten-minute tour

> Updated every milestone.
> Read top to bottom and you will know where everything lives and why.
> For the deep version of any section, follow the link to its learning chapter.

Current state: **M6 complete** (M3, the browser library, is Lakhte's and in progress).
Data model, migrations, seed, ingest endpoint, analytics API, schema snapshot, typed documents, and the dashboard UI with Storybook are in place.
Prepared ahead of their milestones: the stress seed (M8), demo-mode plumbing (M10), and the Apollo Next.js integration modules (M7).

## The one-paragraph version

Vitals is a self-hostable real-user-monitoring kit.
A small browser library (coming in M3, Lakhte-built) captures Core Web Vitals and posts them to `/api/collect` (M2).
A Next.js app stores them in SQLite through Drizzle, exposes them through a Pothos-built GraphQL schema served by Yoga at `/api/graphql`, and renders a dashboard with Apollo Client.

## Directory map

```
.
├── src/
│   ├── app/                  Next.js App Router
│   │   ├── api/graphql/      GraphQL endpoint (Yoga)
│   │   ├── api/collect/      ingest endpoint (two-line glue over src/collect)
│   │   ├── layout.tsx        HTML shell, wraps pages in Providers
│   │   ├── providers.tsx     Apollo Client + ApolloProvider
│   │   ├── apollo/           Apollo <-> Next.js integration: browser wrapper, RSC client (SchemaLink)
│   │   ├── DemoBanner.tsx    one-line banner, rendered only when VITALS_DEMO_MODE=1
│   │   └── page.tsx          the dashboard overview: site picker, FilterBar, MetricCards, PagesTable, SessionsTable
│   ├── graphql/
│   │   ├── builder.ts        the Pothos builder (plugins, scalar types)
│   │   ├── scalars.ts        DateTime
│   │   ├── enums.ts          MetricName, MetricRating, DeviceClass, ConnectionType
│   │   ├── types/            MetricSummary, Session + Pageview (loadableList relation)
│   │   ├── loaders/          batch functions DataLoader calls (Page.metrics)
│   │   ├── schema.ts         Page, Site, root queries, toSchema()
│   │   ├── generated/        GraphQL Codegen output: graphql() + TypedDocumentNodes (committed, never edited)
│   │   └── *.test.ts         schema + metrics tests (percentiles, query-cost pins)
│   ├── collect/              ingest: zod payload contract, persistence, HTTP handler, demo rate limiter + tests
│   ├── config/               demo-mode flag
│   ├── dashboard/            UI feature: components/ (+ stories, CSS modules), filters, sortPages, chartScale, labels
│   ├── vitals/               domain vocabulary: metric names, thresholds, ratings, dimensions
│   └── db/
│       ├── schema.ts         the four tables (sites, sessions, pageviews, metric_events)
│       ├── index.ts          open SQLite, run migrations, makeDb / getDb
│       ├── queries/          SQL that resolvers call: pages, metrics (window-function percentiles), sessions
│       ├── query-counter.ts  counts statements; behind every README query number
│       ├── synthetic/        deterministic fake-traffic generator
│       └── seed.ts           idempotent demo seed + stress seed (CLI: scripts/seed-db.ts)
├── drizzle/                  generated migrations + snapshots (npm run db:generate)
├── scripts/                  seed-db.ts (db:seed, db:seed:stress), measure-query-count.ts, print-schema.ts
├── .storybook/               Storybook 10: nextjs-vite framework, a11y + vitest addons
├── schema.graphql            the schema snapshot; a test and CI fail if it drifts from src/graphql
├── codegen.ts                GraphQL Codegen config (npm run codegen)
├── e2e/                      Playwright specs
├── docs/
│   ├── TOUR.md               this file
│   ├── NEEDS-LAKHTE.md       everything only the owner can do (accounts, pushes, deploys)
│   └── learning/             one chapter per milestone + GLOSSARY.md
├── .github/workflows/ci.yml  lint, typecheck, unit, e2e
├── PLAN.md                   milestone plan, guardrails, session log
├── TESTING_RULES.md          how we decide what to test
└── README.md                 public front page, decisions, measured metrics
```

## Follow a request

Browser `page.tsx` -> Apollo `useQuery` -> `POST /api/graphql` -> `route.ts` -> Yoga -> Pothos resolvers in `schema.ts` -> `db/queries/pages.ts` -> Drizzle -> better-sqlite3 -> `.data/vitals.db`.
Chapter 00 walks this path step by step; chapter 01 explains the tables it reads.

## Follow a delivery

Browser `sendBeacon` -> `POST /api/collect` -> `route.ts` -> `collect/handle.ts` (size, JSON, zod, site) -> `collect/ingest.ts` (one transaction, conflict-ignoring inserts) -> `202 { inserted, duplicates }`.
Chapter 02 explains each step and the error codes.

## Follow a batched field

`site { pages { metrics } }`: the `pages` resolver returns 10 pages -> graphql-js calls `Page.metrics` ten times in the same tick -> each call hands DataLoader a `(site, path, range)` key -> after the tick, DataLoader calls `batchLoadPageMetrics` once with all ten -> one window-function statement -> results handed back in key order.
Three statements total; the naive version cost twelve.
Chapter 04 is the full story and the interview answer.

## The data model in one breath

A **site** has **sessions** (one visit: device, connection, browser).
A session has **pageviews** (one navigation: path, time).
A pageview has **metric events** (one LCP, CLS, INP, TTFB, or FCP value with its rating).
Ids for sessions and pageviews come from the browser so retried deliveries dedupe; metric events dedupe on (pageview, name, metric id).
All timestamps are epoch milliseconds.

## Where the tests are

| Level | Location | Runs against | Command |
| ----- | -------- | ------------ | ------- |
| Unit | `src/**/*.test.ts` | schema executed in-process, `:memory:` SQLite | `npm run test` |
| Stories | `src/**/*.stories.tsx` | each story in headless Chromium: render, play function, axe | `npm run test:storybook` |
| E2E | `e2e/*.spec.ts` | real dev server + Chromium, `.data/e2e.db` | `npm run test:e2e` |

CI runs both plus `typecheck` and `lint`.
The rule for what deserves a test is in TESTING_RULES.md.

## When you change the schema

1. Edit `src/graphql/**`.
2. `npm run codegen` rewrites `schema.graphql` and `src/graphql/generated/`.
3. Commit all three together; the snapshot test and `codegen:check` in CI enforce it.

## Run it

```bash
npm install
npm run db:seed          # or npm run db:seed:stress for ~100k events
npm run dev              # http://localhost:3000, GraphiQL at /api/graphql
npm run storybook        # http://localhost:6006
```

## Learning chapters

- [00 - The walking skeleton](learning/00-the-skeleton.md): every file in the starting repo and why it exists.
- [01 - The data model](learning/01-data-model.md): the four tables, migrations, and how the seed fakes realistic traffic.
- [02 - Ingestion](learning/02-ingestion.md): sendBeacon, batching, idempotent delivery, and what validation protects against.
- [03 - The browser library: brief](learning/03-library-brief.md): Lakhte's build; the contract, reading list, acceptance criteria, and pitfalls.
- [04 - N+1 and DataLoader](learning/04-n-plus-one-and-dataloader.md): the naive query log line by line, exactly what DataLoader batches and when, measured before/after.
- [05 - Codegen and the schema snapshot](learning/05-codegen-and-schema-snapshot.md): what the generator emits, how `useQuery` becomes typed, and why CI fails on drift.
- [06 - Dashboard UI and Storybook](learning/06-dashboard-ui-and-storybook.md): the five components, stories and play functions, interaction tests versus e2e, axe per story.
- Drafts ahead of their milestones: [07](learning/07-streaming-ssr-and-rsc.md), [08](learning/08-performance-on-itself.md), [09](learning/09-accessibility.md), [10](learning/10-deploy-and-demo-mode.md), [99 - use as a template](learning/99-use-as-template.md).
- [Glossary](learning/GLOSSARY.md): every term of art, two or three sentences each.

## Environment variables

| Variable | Default | Used by |
| -------- | ------- | ------- |
| `VITALS_DB_PATH` | `.data/vitals.db` | app, seed, drizzle-kit; Playwright sets `.data/e2e.db` |
| `VITALS_DEMO_MODE` | unset | `1` = temp-dir database seeded on open, GraphiQL off, collect rate-limited, banner shown |
