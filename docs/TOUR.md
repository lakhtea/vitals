# The ten-minute tour

> Updated every milestone.
> Read top to bottom and you will know where everything lives and why.
> For the deep version of any section, follow the link to its learning chapter.

Current state: **M9, M12, M13, and M14 complete, M8 and M10 code complete** (M3, the browser library, is Lakhte's and in progress; the M8 self-measurement panel and the M10 deploy wait on it and on his accounts).
Plan amended 2026-10-14: M12 to M15 add incidents, health checks, the MCP boundary, an in-dashboard editor for the agent's proposed fix, and the triage worker; M12 to M14 are built, M15 (the triage worker) is next, see PLAN.md.
Data model, migrations, seeds, ingest endpoint, analytics API, schema snapshot, typed documents, dashboard UI with Storybook, server-rendered first paint, bundle budget, virtualised sessions table, axe and keyboard e2e, and demo mode are in place.

## The one-paragraph version

Vitals is a self-hostable real-user-monitoring kit.
A small browser library (coming in M3, Lakhte-built) captures Core Web Vitals and posts them to `/api/collect` (M2).
A Next.js app stores them in SQLite through Drizzle, exposes them through a Pothos-built GraphQL schema served by Yoga at `/api/graphql`, and renders a dashboard with Apollo Client.
Since M12 any application can also push health checks to `/api/checks`; a deterministic detector turns vitals regressions and failing checks into incidents, and a person approves or dismisses them on the incident page, the human gate the triage agents (M15) will stop at.
Since M13 agents reach incidents through an MCP server in `services/vitals-mcp`, which calls the same GraphQL API with a service token; the dashboard itself still never calls a model.
Since M14 an agent's proposed change is shown on the incident page as a diff; a person can edit it in a lazily loaded CodeMirror editor, which writes a new revision, and approval pins the exact revision.

## Directory map

```
.
├── src/
│   ├── app/                  Next.js App Router
│   │   ├── api/graphql/      GraphQL endpoint (Yoga)
│   │   ├── api/collect/      ingest endpoint (two-line glue over src/collect)
│   │   ├── api/checks/       health-check endpoint, write-key protected (glue over src/checks)
│   │   ├── incidents/[id]/   the incident page: Server Component resolves one incident, IncidentView hydrates the decision form; not-found.tsx
│   │   ├── sites/[siteId]/pages/[[...path]]/   the page detail: one path's cards, trend, breakdowns, sessions; filters in the URL (M16)
│   │   ├── layout.tsx        HTML shell, wraps pages in ApolloWrapper
│   │   ├── apollo/           Apollo <-> Next.js integration: browser wrapper, RSC client (SchemaLink)
│   │   ├── DemoBanner.tsx    one-line banner, rendered only when VITALS_DEMO_MODE=1
│   │   └── page.tsx          Server Component: fetches in-process, hands props to DashboardView + the self-measurement panel
│   ├── graphql/
│   │   ├── builder.ts        the Pothos builder (plugins, scalar types)
│   │   ├── scalars.ts        DateTime
│   │   ├── enums.ts          MetricName, MetricRating, DeviceClass, ConnectionType, SeriesBucket
│   │   ├── types/            MetricSummary, Session + Pageview (loadableList relation), Check, Incident + evidence + steps, MetricSeries, PageBreakdown
│   │   ├── loaders/          batch functions DataLoader calls (Page.metrics)
│   │   ├── schema.ts         Page, Site, root queries, the decision and detection mutations, toSchema()
│   │   ├── generated/        GraphQL Codegen output: graphql() + TypedDocumentNodes (committed, never edited)
│   │   └── *.test.ts         schema + metrics tests (percentiles, query-cost pins), page-detail (series buckets, page fields)
│   ├── collect/              ingest: zod payload contract, persistence, HTTP handler, demo rate limiter + tests
│   ├── auth/                 bearer-token parsing and constant-time comparison, shared by /api/checks and the service token
│   ├── checks/               health checks: status vocabulary, zod payload, persistence, write-key HTTP handler, the HTTP probe + tests
│   ├── incidents/            vocabulary (statuses, transitions, roles), evidence shapes, the pure detector, detectIncidents, fix revision rules, unified diffs + tests
│   ├── demo/                 the flag-gated regression (VITALS_DEMO_REGRESSION=1) the seeded proposed fix targets
│   ├── config/               demo-mode flag
│   ├── dashboard/            UI feature: components/ (+ stories, CSS modules), queries.ts, filters, routes (every URL), pageDetail (URL -> filters), overviewModel (query result -> props), attention (what is wrong, in words), sortPages, rowWindow, chartScale, labels, adapters, dates, incidents, fix-review
│   │   ├── components/DashboardView.tsx   "use client": site + filter state, useQuery on change only
│   │   ├── components/AttentionStrip, Brand, SelectField, SectionHeader, EmptyState   the overview's chrome, reused by the other routes
│   │   ├── components/Toolbar, Sparkline, MetricTrend, StatusPill, Callout, Timestamp, BackToOverview   shared by every route
│   │   ├── components/VitalsComparison, StepIcon, FixReview, DiffView   the incident page
│   │   └── components/PageDetailView, PageDetailHeader, PageFilters, BreakdownTable, PageDetailEmptyState   the page detail
│   ├── vitals/               domain vocabulary: metric names, thresholds, ratings, dimensions, series buckets, formatting
│   └── db/
│       ├── schema.ts         seven tables: sites, sessions, pageviews, metric_events + checks, incidents, incident_steps
│       ├── index.ts          open SQLite, run migrations, makeDb / getDb
│       ├── queries/          SQL that resolvers call: pages, metrics (window-function percentiles), series (p75 per bucket), sessions, checks, incidents, steps, breakdown (incident + page), fix revisions
│       ├── query-counter.ts  counts statements; behind every README query number
│       ├── synthetic/        deterministic fake-traffic generator, the /pricing regression fixture, the health-check fixture
│       └── seed.ts           idempotent demo seed + stress seed (CLI: scripts/seed-db.ts)
├── services/vitals-mcp/      the MCP server agents connect to: GraphQL client, typed documents, four tools, stdio entry + protocol tests
├── .mcp.json                 registers that server with Claude Code (token from your environment)
├── drizzle/                  generated migrations + snapshots (npm run db:generate)
├── scripts/                  seed-db.ts, detect-incidents.ts, check-probe.ts, measure-query-count.ts, print-schema.ts, check-bundle-budget.ts, measure-render.ts
├── bundle-budget.json        committed First Load JS baseline per route ("/", "/incidents/[id]"; CI fails above +10%)
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
│   ├── screenshots/          before and after the M16 design pass
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

## Follow a drill-down

A path link in the pages table -> `routes.ts` `pageDetailHref` -> `/sites/<id>/pages/<path>?range=...` -> `sites/[siteId]/pages/[[...path]]/page.tsx` -> `pageDetail.ts` parses the search params into the same `DashboardFilters` the overview holds in state -> `PAGE_DETAIL` in-process -> complete HTML -> `PageFilters` pushes a new URL on change and the server answers again.
Chapter 16 explains why this route keeps filters in the URL and the overview does not.

## Follow a delivery

Browser `sendBeacon` -> `POST /api/collect` -> `route.ts` -> `collect/handle.ts` (size, JSON, zod, site) -> `collect/ingest.ts` (one transaction, conflict-ignoring inserts) -> `202 { inserted, duplicates }`.
Chapter 02 explains each step and the error codes.

## Follow a detection

`npm run incidents:detect` -> `scripts/detect-incidents.ts` -> `incidents/detect.ts` loads two 24-hour windows of per-path p75s (one window-function statement each) and the check history -> `incidents/detector.ts` (pure: sample floor, relative increase, rating band, failing or degraded streak) returns findings -> one transaction opens an `incidents` row per new finding and resolves open ones whose finding is gone -> the overview lists them, `/incidents/[id]` shows the evidence, and a person's approve or dismiss becomes an `incident_steps` row.
Chapter 12 explains the rules and the state machine.

## Follow a health check

An application -> `POST /api/checks` with `Authorization: Bearer <write key>` -> `route.ts` -> `checks/handle.ts` (size, JSON, zod, site, key) -> `checks/ingest.ts` (conflict-ignoring insert on site + check id + observed time) -> `202 { inserted, duplicates }` -> the newest row per check is the health panel, the history is what the detector reads.

## Follow an agent call

An agent in Claude Code (or the M15 worker) -> `tools/call record_step` over stdio -> `services/vitals-mcp/server.ts` -> `tools.ts` validates the input with zod -> `client.ts` posts the typed `McpRecordStep` document to `/api/graphql` with `Authorization: Bearer <VITALS_SERVICE_TOKEN>` -> `createContext` marks the request as a service -> `recordStep` resolver (`requireService`, then `db/queries/steps.ts` in one transaction) -> the step is in `incident_steps` and on `/incidents/[id]`.
No tool calls `approveIncident` or `dismissIncident`, and `transitionIncident` refuses any target outside the agent path; chapter 13 explains both.

## Follow a batched field

`site { pages { metrics } }`: the `pages` resolver returns 10 pages -> graphql-js calls `Page.metrics` ten times in the same tick -> each call hands DataLoader a `(site, path, range)` key -> after the tick, DataLoader calls `batchLoadPageMetrics` once with all ten -> one window-function statement -> results handed back in key order.
Three statements total; the naive version cost twelve.
Chapter 04 is the full story and the interview answer.

## The data model in one breath

A **site** has **sessions** (one visit: device, connection, browser).
A session has **pageviews** (one navigation: path, time).
A pageview has **metric events** (one LCP, CLS, INP, TTFB, or FCP value with its rating).
Ids for sessions and pageviews come from the browser so retried deliveries dedupe; metric events dedupe on (pageview, name, metric id).
A site also has **checks** (one row per health observation, deduped on check id and time) and **incidents** (one live incident per path-and-metric or check, with JSON evidence), each with **incident steps** (agent work and human decisions, in order).
All timestamps are epoch milliseconds.

## Where the tests are

| Level | Location | Runs against | Command |
| ----- | -------- | ------------ | ------- |
| Unit | `src/**/*.test.ts` | schema executed in-process, `:memory:` SQLite | `npm run test` |
| Stories | `src/**/*.stories.tsx` | each story in headless Chromium: render, play function, axe | `npm run test:storybook` |
| E2E | `e2e/*.spec.ts` (home, collect, ssr with JS off, a11y via axe, keyboard path, incidents: list, keyboard dismiss, axe, an agent walking the gate with the service token, fix review editing, page detail with JS off) | real dev server + Chromium, `.data/e2e.db`, seeded and detected | `npm run test:e2e` |

CI runs all three plus `typecheck`, `lint`, `codegen:check`, and the bundle budget.
The rule for what deserves a test is in TESTING_RULES.md.

## When you change the schema

1. Edit `src/graphql/**`.
2. `npm run codegen` rewrites `schema.graphql`, `src/graphql/generated/` (the dashboard's documents), and `services/vitals-mcp/generated/` (the MCP tools' documents).
3. Commit them together; the snapshot test and `codegen:check` in CI enforce it.

## Run it

```bash
npm install
npm run db:seed          # or npm run db:seed:stress for ~100k events
npm run incidents:detect # open incidents for the seeded regression and the failing check
npm run mcp:vitals       # the MCP server on stdio (Claude Code starts it from .mcp.json; needs VITALS_SERVICE_TOKEN)
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
- [12 - Incidents and health checks](learning/12-incidents-and-health-checks.md): detection as statistics, the incident state machine, push-first checks and the write key, the first detail route.
- [13 - Agent connection](learning/13-agent-connection.md): MCP from first principles, thin tools over GraphQL, service tokens, the health probe, the breakdown.
- [14 - Fix review](learning/14-fix-review.md): a change as base SHA plus contents, diff algorithms, CodeMirror 6, lazy loading under a route budget, immutable revisions.
- [16 - Design pass and page detail](learning/16-design-pass.md): design tokens and scales, one series behind sparkline and chart, bucketing in SQL, filters in the URL versus in state, the catch-all route.
- [99 - Use this repo as a template](learning/99-use-as-template.md): keep/replace lists and the order to replace things in (draft, refreshed at M11).
- [Glossary](learning/GLOSSARY.md): every term of art, two or three sentences each.

## Environment variables

| Variable | Default | Used by |
| -------- | ------- | ------- |
| `VITALS_DB_PATH` | `.data/vitals.db` | app, seed, drizzle-kit; Playwright sets `.data/e2e.db` |
| `VITALS_DEMO_MODE` | unset | `1` = temp-dir database seeded on open, GraphiQL off, collect rate-limited, banner shown |
| `VITALS_SERVICE_TOKEN` | unset | the secret agents present as a bearer token; `recordStep` and `transitionIncident` refuse every call while it is unset; the MCP server sends it |
| `VITALS_URL` | `http://localhost:3000` | where the MCP server and `npm run checks:probe` find the dashboard |
| `VITALS_DEMO_REGRESSION` | unset | `1` = the overview waits 1.5 s on a simulated upstream (the planted cause behind the seeded proposed fix) |
| `VITALS_WRITE_KEY` | unset | the site's write key `npm run checks:probe` pushes with (the seed's demo key is `demo-write-key`) |
