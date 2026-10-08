# The ten-minute tour

> Updated every milestone.
> Read top to bottom and you will know where everything lives and why.
> For the deep version of any section, follow the link to its learning chapter.

Current state: **M1 complete.**
The RUM data model is in place with real migrations and a deterministic synthetic seed.
The dashboard lists measured pages with their traffic counts.

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
│   │   ├── layout.tsx        HTML shell, wraps pages in Providers
│   │   ├── providers.tsx     Apollo Client + ApolloProvider
│   │   └── page.tsx          the dashboard home: pages table
│   ├── graphql/              Pothos builder, context, schema, schema tests
│   ├── vitals/               domain vocabulary: metric names, thresholds, ratings, dimensions
│   └── db/
│       ├── schema.ts         the four tables (sites, sessions, pageviews, metric_events)
│       ├── index.ts          open SQLite, run migrations, makeDb / getDb
│       ├── queries/          SQL that resolvers call (per-path aggregates)
│       ├── synthetic/        deterministic fake-traffic generator
│       └── seed.ts           idempotent demo seed (npm run db:seed)
├── drizzle/                  generated migrations + snapshots (npm run db:generate)
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
| E2E | `e2e/*.spec.ts` | real dev server + Chromium, `.data/e2e.db` | `npm run test:e2e` |

CI runs both plus `typecheck` and `lint`.
The rule for what deserves a test is in TESTING_RULES.md.

## Run it

```bash
npm install
npm run db:seed
npm run dev          # http://localhost:3000, GraphiQL at /api/graphql
```

## Learning chapters

- [00 - The walking skeleton](learning/00-the-skeleton.md): every file in the starting repo and why it exists.
- [01 - The data model](learning/01-data-model.md): the four tables, migrations, and how the seed fakes realistic traffic.
- [Glossary](learning/GLOSSARY.md): every term of art, two or three sentences each.

## Environment variables

| Variable | Default | Used by |
| -------- | ------- | ------- |
| `VITALS_DB_PATH` | `.data/vitals.db` | app, seed, drizzle-kit; Playwright sets `.data/e2e.db` |
