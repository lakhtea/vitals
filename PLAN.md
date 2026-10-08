# Vitals — Build Plan

> **Read this first, every session.** This is the working plan for Claude Code.
> Work top-to-bottom through the milestones. Do not skip ahead, do not expand
> scope. Each work session: (1) read this file and README.md, (2) run the
> baseline checks, (3) pick the next unchecked item, (4) build it to its
> Definition of Done, (5) update the checkboxes here, append to the Session Log
> at the bottom, and commit. Leave the tree green.

## What this project is

A self-hostable RUM (real-user monitoring) kit with two parts: a tiny browser
library that captures Core Web Vitals from real sessions, and a GraphQL
analytics dashboard (this Next.js app) to explore them. The owner, Lakhte,
builds it as deliberate, demonstrable evidence of specific skills for his job
search: GraphQL depth (schema design, resolvers, N+1/DataLoader, cache
normalization), Next.js App Router depth (RSC, streaming SSR), Storybook,
frontend performance with real measured numbers, library release engineering
(semver, changelogs, ESM/CJS builds), and accessibility. Every milestone
exists to make one of those claims honest and demoable. The repo will be
public on github.com/lakhtea — write every file as if a hiring manager will
read it, because one will.

History note: this repo began as "pipeline," a job-tracker scaffold. It was
repointed to Vitals on 2026-10-08 because the owner had already built and
ships a tracker (separate private repo). The walking skeleton (schema →
resolver → Yoga → Apollo table, tests, CI) carries over; the domain model does
not — replacing it is M1.

## Stack (fixed — do not swap pieces)

- Next.js 16 App Router + React 19, TypeScript strict
- GraphQL: Pothos (code-first) + GraphQL Yoga at `/api/graphql`, DataLoader via `@pothos/plugin-dataloader`
- Client: Apollo Client (normalized cache)
- DB: SQLite via better-sqlite3 + Drizzle ORM (`:memory:` in unit tests)
- Library build (M3): tsup or equivalent producing ESM + CJS + d.ts; `web-vitals` as its only runtime dependency (log the decision if that changes)
- Tests: Vitest (unit), Playwright (e2e), GitHub Actions CI (`.github/workflows/ci.yml`)

## Hard guardrails

1. **Scope:** Core Web Vitals (LCP, CLS, INP, TTFB, FCP) by page, device
   class, and connection type; sessions; percentile aggregates; the collection
   library; the instrumentation/polish milestones below. NO error tracking, NO
   session replay, NO alerting, NO multi-tenant auth, NO AI features. If a
   feature idea appears mid-session, add one line to "Parked ideas" at the
   bottom instead of building it.
2. **Green tree rule:** `npm run typecheck && npm run lint && npm run test`
   must pass before every commit. `npm run test:e2e` must pass before checking
   off any milestone. Never check a box on a red tree.
3. **Honest metrics:** every number in README.md (query counts, render
   timings, bundle sizes, the dashboard's own vitals) must come from an actual
   measurement made in this repo, with the measurement method committed
   (script, test, or documented command). Never estimate. If a number is not
   yet measured, write TBD.
4. **Tests ride with features:** each resolver/endpoint/component lands in the
   same commit as its tests. A milestone's DoD always includes its tests.
5. **Decisions log:** any non-obvious technical choice gets a short entry in
   README "Decisions" using the existing format: problem → options → choice →
   tradeoff. One paragraph, no essays.
6. **Metric correctness:** vitals semantics follow web.dev definitions — p75
   as the headline aggregate, the good/needs-improvement/poor thresholds per
   metric, INP not FID. When unsure about a metric's definition, read the
   `web-vitals` package docs in node_modules rather than guessing.
7. **Commits:** conventional commits (`feat:`, `fix:`, `test:`, `docs:`,
   `chore:`), small and self-contained. Do not squash unrelated work.
8. **Next.js version caution:** AGENTS.md carries the auto-generated
   `nextjs-agent-rules` block. This Next.js is newer than training data: check
   `node_modules/next/dist/docs/` before using an App Router API you have not
   verified in this repo.

## Milestones

### M0 — Baseline verification (every fresh clone / first session)
- [ ] `npm install` clean; current (tracker-flavored) seed and tests still green: `typecheck`, `lint`, `test`, `test:e2e`
- [ ] CI workflow runs the same four checks; fix any drift between CI and local
- DoD: all checks green, one `chore:` commit if anything needed fixing.

### M1 — Domain model swap (tracker → RUM)
Replace the leftover tracker domain entirely. Nothing tracker-shaped survives.
- [ ] Drizzle schema: `sites` (even if v1 seeds exactly one), `sessions` (id, site, startedAt, device class, connection type, user agent family), `pageviews` (session, path, timestamp), `metric_events` (pageview, metric name, value, rating, timestamp)
- [ ] Idempotent synthetic seed: ~50 sessions across ~10 paths with realistic distributions (log-normal-ish LCP, mostly-zero CLS with outliers, INP spread), device/connection mix; re-running must not duplicate
- [ ] Pothos types + root queries for the new domain (sites, pages with basic aggregates); delete tracker types/resolvers
- [ ] Rewrite the walking-skeleton UI table to list pages with event counts; update unit + e2e tests to the new domain
- DoD: no application/contact/stage code anywhere (`grep -ri` for the old
  nouns comes back empty outside git history); seed idempotent (run twice,
  verify); all tests green on the new domain.

### M2 — Ingestion path
- [ ] `POST /api/collect`: accepts a sendBeacon-compatible JSON batch (session metadata + metric events), validates shape and metric names/ranges with typed errors, writes via Drizzle
- [ ] Batching semantics: one request may carry several events; dedupe by (pageview, metric, id) so retries are safe
- [ ] Unit tests: happy path, malformed payload, unknown metric, oversized batch (cap documented), duplicate delivery
- [ ] e2e: a scripted fake session posts a batch and the dashboard shows it
- DoD: collect endpoint documented in README (payload example), all tests
  green, dedupe proven by a test.

### M3 — The library (`lib/vitals-client`)
This closes the "library release engineering" claim — treat packaging as part
of the product.
- [ ] `lib/vitals-client/`: wraps the `web-vitals` package; captures LCP, CLS, INP, TTFB, FCP plus path, device class (coarse, from UA-CH or viewport), connection type (navigator.connection when present); batches and flushes via `navigator.sendBeacon` on visibilitychange/pagehide with fetch fallback
- [ ] Public API: `initVitals({ endpoint, siteId, sampleRate? })` and nothing else in v1; no framework coupling
- [ ] Build with tsup (or equivalent): ESM + CJS + `.d.ts`, `sideEffects: false`, size reported by the build; unit tests for batching/flush logic (jsdom)
- [ ] `lib/vitals-client/CHANGELOG.md` kept by hand from 0.1.0, semver discipline from the start; `npm pack` artifact buildable (actual `npm publish` is Lakhte's — see Blocked)
- [ ] Integration doc in the library README: the two-line snippet for any site
- DoD: `npm pack` produces a clean tarball; dashboard dogfoods the library in
  dev (its own sessions appear); bundle size of the built lib recorded in
  README (measured).

### M4 — GraphQL analytics API (the DataLoader showpiece — do this carefully)
- [ ] Query-count instrumentation first: a committed counter (Drizzle logger or driver wrap) usable in tests
- [ ] Aggregates: per-page p75 (and p50/p90) per metric over a time range; rating buckets per web.dev thresholds; site-level rollup
- [ ] Implement `Page.metrics` naively; record the measured N+1 count in README's metrics table
- [ ] Convert to DataLoader via `@pothos/plugin-dataloader`; record the after count; add a regression test pinning the batched count
- [ ] Second batched relation (e.g. `Session.pageviews`) to show it generalizes
- [ ] README "Decisions" entry: DataLoader vs aggregate-at-the-root SQL, with the tradeoff honestly stated (SQL could do this in one query; the point is demonstrating the general pattern, and the entry should say so)
- DoD: metrics table filled with measured before/after numbers and method
  linked; regression test green.

### M5 — Typed operations + schema snapshot
- [ ] GraphQL Codegen for client operations (typed hooks or typed documents; pick one, log the decision)
- [ ] Commit a generated `schema.graphql` snapshot; CI step regenerates and fails on drift
- [ ] Migrate client queries to generated types; delete hand-written operation types
- DoD: no hand-rolled operation types on the client; CI fails on snapshot
  drift.

### M6 — Dashboard UI + Storybook
Hand-rolled components, minimal consistent design (CSS modules or
vanilla-extract; log the decision). No component library dependency. Charts
hand-rolled SVG or a micro-lib (log the decision; no heavyweight chart
frameworks).
- [ ] Components: `MetricCard` (p75 + rating color per web.dev thresholds), `TimeSeriesChart`, `PagesTable`, `SessionsTable`, `FilterBar` (time range, device, connection)
- [ ] Storybook configured for Next.js; a story per component including edge states (empty, loading, all-poor ratings, long paths, huge values)
- [ ] Interaction tests (play functions) for FilterBar and PagesTable sorting at minimum; `@storybook/test-runner` wired into CI
- [ ] A11y addon enabled; fix what it flags
- DoD: `npm run storybook` works; every component above has stories; at least
  two interaction tests pass in CI.

### M7 — App Router depth: streaming SSR + RSC boundaries
- [ ] Integrate `@apollo/client-integration-nextjs`; first paint of the overview streams from the server, filters/interactions stay client-side
- [ ] Explicit, minimal server/client split ("use client" only where interaction demands it); short README section documenting the boundary
- [ ] Suspense loading UI matching final layout (no layout shift — this app of all apps must not ship CLS)
- [ ] e2e asserts the overview renders with JS disabled (initial HTML contains seeded aggregates)
- DoD: server-rendered HTML carries real content, verified by e2e; decision
  entry on the integration approach.

### M8 — Performance on itself (the self-referential showpiece)
- [ ] Stress seed behind a flag (~100k metric events across ~2k sessions); virtualize SessionsTable and PagesTable (TanStack Virtual or hand-rolled; log the decision); measure render before/after with a committed method
- [ ] Self-instrumentation in production mode: the dashboard loads its own built library and reports into itself; a small "This site, measured by itself" panel shows the dashboard's own p75s
- [ ] Bundle budget: record the dashboard route's first-load JS; CI fails if it exceeds baseline + 10%
- [ ] All measured numbers in README's metrics section
- DoD: every number measured with committed method; CI enforces the budget;
  the self-measurement panel shows real collected data.

### M9 — Accessibility pass
- [ ] axe checks in Playwright (`@axe-core/playwright`) on overview + a detail view, zero serious/critical violations
- [ ] Full keyboard path e2e: change filters, sort the pages table, open a session without a mouse
- [ ] Charts have non-visual equivalents (data table fallback or aria summary); visible focus states throughout
- DoD: axe e2e green in CI; keyboard e2e green.

### M10 — Deploy + demo mode
- [ ] Decide hosting for a single-tenant SQLite app (likely Vercel + demo mode: ephemeral seeded DB per cold start, "demo data resets" banner; alternative libSQL/Turso). Write the decision entry BEFORE building
- [ ] Deploy; seeded demo + self-instrumentation live at a public URL; GraphiQL disabled or read-only in demo; /api/collect rate-capped in demo
- [ ] README: live demo link at top, badge `<USER>` swapped to `lakhtea`, screenshots heavy on substance
- DoD: public URL works from a clean browser; the self-measurement panel is
  live.

### M11 — Public polish (last)
- [ ] README final pass: architecture diagram accurate, every Decisions entry present, metrics tables complete, no TBDs left
- [ ] `LICENSE` sanity check; GitHub repo description + topics suggestions listed in the Session Log for Lakhte
- [ ] Lakhte creates github.com/lakhtea/vitals and pushes (HE pushes; Claude Code prepares everything but never creates accounts or pushes to a remote it was not given); npm publish of the library is likewise his
- DoD: `git log` tells a coherent story; a stranger can clone, seed, run, and
  understand every claim in the README within ten minutes.

## Working agreements for long autonomous runs

- Work milestones strictly in order; within a milestone, checkboxes in order
  unless a blocker forces a swap (note the swap in the Session Log).
- If blocked (missing credential, ambiguous product call, deploy or npm
  account needed), write the question under "Blocked / needs Lakhte" in the
  Session Log, pick the next unblocked item, and continue. Never invent
  credentials, never create external accounts.
- Prefer boring solutions. This repo demonstrates judgment, and judgment reads
  as restraint.
- Keep `npm run db:seed` idempotent forever; tests must never depend on seed
  order.
- Update this file's checkboxes in the same commit as the work they describe.

## Parked ideas (append here instead of building)

- Instrumenting the owner's other apps with the library (his call, not a
  milestone).

## Blocked / needs Lakhte

- M10 hosting account (Vercel or similar) when M10 starts.
- M11 GitHub repo creation + push, and `npm publish` of the library
  (Lakhte's accounts).

## Session Log

Append one short entry per session: date, items completed, measurements taken,
decisions logged, anything blocked.

- 2026-10-08 — Repo created from the verified-green pipeline scaffold, then
  REPOINTED from job tracker to Vitals (RUM kit): the owner already ships a
  tracker (separate private repo), so the domain changed while the skill
  targets stayed. README/PLAN/CLAUDE rewritten; package renamed to "vitals";
  folder renamed Desktop/vitals. Baseline state: generic walking skeleton
  (schema → resolver → Yoga → Apollo table) with unit + e2e tests and CI,
  still tracker-flavored until M1. Next: M0, then M1 domain swap.
