# The ten-minute tour

> Updated every milestone.
> Read top to bottom and you will know where everything lives and why.
> For the deep version of any section, follow the link to its learning chapter.

Current state: **M9 complete, M8 and M10 code complete** (M3, the browser library, is Lakhte's and in progress; the M8 self-measurement panel and the M10 deploy wait on it and on his accounts).
Data model, migrations, seeds, ingest endpoint, analytics API, schema snapshot, typed documents, dashboard UI with Storybook, server-rendered first paint, bundle budget, virtualised sessions table, axe and keyboard e2e, and demo mode are in place.

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
│   │   ├── layout.tsx        HTML shell, wraps pages in ApolloWrapper
│   │   ├── apollo/           Apollo <-> Next.js integration: browser wrapper, RSC client (SchemaLink)
│   │   ├── DemoBanner.tsx    one-line banner, rendered only when VITALS_DEMO_MODE=1
│   │   └── page.tsx          Server Component: fetches in-process, hands props to DashboardView + the self-measurement panel
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
│   ├── dashboard/            UI feature: components/ (+ stories, CSS modules), queries.ts, filters, sortPages, rowWindow, chartScale, labels, adapters, dates
│   │   └── components/DashboardView.tsx   "use client": site + filter state, useQuery on change only
│   ├── vitals/               domain vocabulary: metric names, thresholds, ratings, dimensions, formatting
│   └── db/
│       ├── schema.ts         the four tables (sites, sessions, pageviews, metric_events)
│       ├── index.ts          open SQLite, run migrations, makeDb / getDb
│       ├── queries/          SQL that resolvers call: pages, metrics (window-function percentiles), sessions
│       ├── query-counter.ts  counts statements; behind every README query number
│       ├── synthetic/        deterministic fake-traffic generator
│       └── seed.ts           idempotent demo seed + stress seed (CLI: scripts/seed-db.ts)
├── drizzle/                  generated migrations + snapshots (npm run db:generate)
├── scripts/                  seed-db.ts, measure-query-count.ts, print-schema.ts, check-bundle-budget.ts, measure-render.ts
├── bundle-budget.json        committed First Load JS baseline for "/" (CI fails above +10%)
├── .storybook/               Storybook 10: nextjs-vite framework, a11y + vitest addons
├── schema.graphql            the schema snapshot; a test and CI fail if it drifts from src/graphql
├── codegen.ts                GraphQL Codegen config (npm run codegen)
├── drizzle.config.ts         drizzle-kit: schema path and migrations folder (npm run db:generate)
├── playwright.config.ts      boots a seeded app on .data/e2e.db before the e2e specs
├── vitest.config.mts         the unit and storybook Vitest projects; @ and graphql aliases
├── next.config.ts            traces drizzle/** into the serverless bundle
├── e2e/                      Playwright specs
├── docs/
│   ├── TOUR.md               this file
│   ├── NEEDS-LAKHTE.md       everything only the owner can do (accounts, pushes, deploys)
│   └── learning/             one chapter per milestone + GLOSSARY.md
├── .github/workflows/ci.yml  lint, typecheck, unit + coverage, codegen check, Storybook tests, e2e, bundle budget
├── PLAN.md                   milestone plan, guardrails, session log
├── TESTING_RULES.md          how we decide what to test
└── README.md                 public front page, decisions, measured metrics
```

## Follow a request

Browser `DashboardView.tsx` -> Apollo `useQuery` -> `POST /api/graphql` -> `route.ts` -> Yoga -> Pothos resolvers in `schema.ts` -> `db/queries/pages.ts` -> Drizzle -> better-sqlite3 -> `.data/vitals.db`.
Chapter 00 walks this path step by step; chapter 01 explains the tables it reads.

## Follow the first paint

Request -> `page.tsx` (Server Component) -> RSC Apollo client -> `SchemaLink` -> Pothos resolvers -> SQLite -> HTML with the data already in it -> `DashboardView` hydrates with the same props (no fetch) -> a filter change runs one `POST /api/graphql`.
Chapter 07 explains RSC, hydration, and why the page awaits data instead of streaming it.

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
| E2E | `e2e/*.spec.ts` (home, collect, ssr with JS off, a11y via axe, keyboard path) | real dev server + Chromium, `.data/e2e.db` | `npm run test:e2e` |

CI runs all three plus `typecheck`, `lint`, `codegen:check`, and the bundle budget.
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
npm run check:bundle     # after npm run build: First Load JS vs the committed baseline
```

## Learning chapters

- [00 - The walking skeleton](learning/00-the-skeleton.md): every file in the starting repo and why it exists.
- [01 - The data model](learning/01-data-model.md): the four tables, migrations, and how the seed fakes realistic traffic.
- [02 - Ingestion](learning/02-ingestion.md): sendBeacon, batching, idempotent delivery, and what validation protects against.
- [03 - The browser library: brief](learning/03-library-brief.md): Lakhte's build; the contract, reading list, acceptance criteria, and pitfalls.
- [04 - N+1 and DataLoader](learning/04-n-plus-one-and-dataloader.md): the naive query log line by line, exactly what DataLoader batches and when, measured before/after.
- [05 - Codegen and the schema snapshot](learning/05-codegen-and-schema-snapshot.md): what the generator emits, how `useQuery` becomes typed, and why CI fails on drift.
- [06 - Dashboard UI and Storybook](learning/06-dashboard-ui-and-storybook.md): the five components, stories and play functions, interaction tests versus e2e, axe per story.
- [07 - Streaming SSR and RSC](learning/07-streaming-ssr-and-rsc.md): rendering from first principles, hydration, why the page awaits data, the no-JS proof.
- [08 - Performance on itself](learning/08-performance-on-itself.md): stress seed, virtualisation, bundle budget, all measured; the self-measurement loop.
- [09 - Accessibility](learning/09-accessibility.md): what axe catches and cannot, the keyboard path, chart fallbacks.
- [10 - Deploy and demo mode](learning/10-deploy-and-demo-mode.md): the hosting decision, what demo mode isolates, what real hosting would change.
- [99 - Use this repo as a template](learning/99-use-as-template.md): keep/replace lists and the order to replace things in (draft, refreshed at M11).
- [Glossary](learning/GLOSSARY.md): every term of art, two or three sentences each.

## Environment variables

| Variable | Default | Used by |
| -------- | ------- | ------- |
| `VITALS_DB_PATH` | `.data/vitals.db` | app, seed, drizzle-kit; Playwright sets `.data/e2e.db` |
| `VITALS_DEMO_MODE` | unset | `1` = temp-dir database seeded on open, GraphiQL off, collect rate-limited, banner shown |
