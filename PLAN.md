# Vitals — Build Plan

> **Read this first, every session.** This is the working plan for Claude Code.
> Work top-to-bottom through the milestones. Do not skip ahead, do not expand
> scope. Each work session: (1) read this file and README.md, (2) run the
> baseline checks, (3) pick the next unchecked item, (4) build it to its
> Definition of Done, (5) update the checkboxes here, append to the Session Log
> at the bottom, and commit. Leave the tree green.
>
> **This is a teaching build.** Lakhte's goals, in his words: the project must
> teach him a lot AND look impressive; Claude Code builds the majority while he
> builds a designated portion he can show he understands; every single thing
> built must be explained — a reasoning for why it exists — so he can read
> through it, use the app, understand the technologies, and reuse the repo as a
> template later. The Teaching Contract below is therefore as binding as the
> engineering guardrails. Unexplained code is unfinished code.

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

## Who builds what: the pairing contract

- **Claude Code builds** every milestone EXCEPT M3, under the Teaching
  Contract below.
- **Lakhte builds M3 — the browser library — himself.** For M3, Claude Code is
  a coach and reviewer, never the author:
  - Claude Code MAY write: the milestone brief (`docs/learning/03-library-brief.md`
    — goal, API contract, concepts with pointers to read first, pitfalls),
    failing acceptance tests clearly marked as scaffolding, and written review
    feedback on Lakhte's code.
  - Claude Code MUST NOT write, rewrite, or "fix" the library's implementation
    or its build config — not even small patches. Review feedback points at
    the problem and the concept; Lakhte types the fix. If he is stuck, he asks
    for a pairing explanation: concepts, diagrams, pseudocode of an analogous
    (not identical) problem — still not the code.
  - M3 commits are made by Lakhte at his keyboard. Claude Code's review notes
    live in `docs/learning/03-library-review.md`, written like a colleague's
    PR review: direct, specific, kind.
  - Any Claude Code session that finds M3 next in line and Lakhte absent:
    write/refresh the brief if needed, then SKIP to the next unblocked
    milestone and note it in the Session Log. Never build M3 to "unblock"
    things.
- This split is the public story of the repo, told honestly in the README at
  M11: AI-assisted by design, with the library human-written and the rest
  human-directed and human-understood. For an engineer whose resume leads with
  AI-assisted tooling, the build process is itself part of the portfolio.

## The Teaching Contract (binding on every Claude Code milestone)

1. **A learning chapter per milestone**, written in the same sitting as the
   code, at `docs/learning/NN-<slug>.md`:
   - What was built, in plain language.
   - **Why every new file and module exists** — one entry per file: the
     problem it solves, why it lives where it lives, what would break without
     it.
   - How the underlying technology actually works (the concept, not just this
     repo's usage: e.g. what cache normalization IS before how Apollo does it).
   - How to see it working: exact commands, what to click, what to look at.
   - 3–5 self-check questions at the end (answers below a spoiler break), so
     Lakhte can test his understanding without re-reading.
2. **`docs/TOUR.md`** — the 10-minute guided read of the codebase, updated
   every milestone. A stranger (or Lakhte in six months) reads it top to
   bottom and knows where everything lives and why.
3. **`docs/learning/GLOSSARY.md`** — every term of art (resolver, DataLoader,
   RSC, p75, hydration, ESM/CJS…) gets a 2–3 sentence entry the first time it
   appears. Link terms from chapters instead of re-explaining.
4. **File headers:** every new source file opens with a 1–3 line comment
   saying why the file exists. Crisp, not chatty — these are read by hiring
   managers too.
5. **Commit bodies explain why**, not just what.
6. **A milestone is not done until its chapter, TOUR update, and glossary
   entries exist.** This is part of every DoD below even where not restated.
7. **Template chapter at the end** (M11): `docs/learning/99-use-as-template.md`
   — how to strip the Vitals domain and reuse the skeleton (Next.js + Pothos/
   Yoga + Apollo + Drizzle + Vitest/Playwright + CI) for a new project, which
   files to keep, which to replace, in what order.

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
- [x] `npm install` clean; current (tracker-flavored) seed and tests still green: `typecheck`, `lint`, `test`, `test:e2e`
- [x] CI workflow runs the same four checks; fix any drift between CI and local
- [x] Bootstrap the teaching layer: `docs/learning/00-the-skeleton.md` explaining the EXISTING walking skeleton file by file (this is Lakhte's orientation chapter — why Pothos, what Yoga does, how the Apollo table gets its data, how the tests run), plus the first `docs/TOUR.md` and `docs/learning/GLOSSARY.md`
- DoD: all checks green; the three teaching files exist and cover everything
  currently in the repo.

### M1 — Domain model swap (tracker → RUM)
Replace the leftover tracker domain entirely. Nothing tracker-shaped survives.
- [x] Drizzle schema: `sites` (even if v1 seeds exactly one), `sessions` (id, site, startedAt, device class, connection type, user agent family), `pageviews` (session, path, timestamp), `metric_events` (pageview, metric name, value, rating, timestamp)
- [x] Idempotent synthetic seed: ~50 sessions across ~10 paths with realistic distributions (log-normal-ish LCP, mostly-zero CLS with outliers, INP spread), device/connection mix; re-running must not duplicate
- [x] Pothos types + root queries for the new domain (sites, pages with basic aggregates); delete tracker types/resolvers
- [x] Rewrite the walking-skeleton UI table to list pages with event counts; update unit + e2e tests to the new domain
- [x] Chapter 01: the data model — why these four tables and not fewer, how Drizzle maps them, what a migration is, how the seed fakes realistic traffic
- DoD: no application/contact/stage code anywhere (`grep -ri` for the old
  nouns comes back empty outside git history); seed idempotent (run twice,
  verify); all tests green on the new domain; chapter 01 done.

### M2 — Ingestion path
- [x] `POST /api/collect`: accepts a sendBeacon-compatible JSON batch (session metadata + metric events), validates shape and metric names/ranges with typed errors, writes via Drizzle
- [x] Batching semantics: one request may carry several events; dedupe by (pageview, metric, id) so retries are safe
- [x] Unit tests: happy path, malformed payload, unknown metric, oversized batch (cap documented), duplicate delivery
- [x] e2e: a scripted fake session posts a batch and the dashboard shows it
- [x] Chapter 02: ingestion — why sendBeacon exists, why batching, why idempotent delivery matters, what the validation protects against
- DoD: collect endpoint documented in README (payload example), all tests
  green, dedupe proven by a test; chapter 02 done.

### M3 — 👤 LAKHTE BUILDS: the library (`lib/vitals-client`)
Claude Code: coach and reviewer only, per the pairing contract. Deliverables
are Lakhte's.
- [ ] Claude Code: write `docs/learning/03-library-brief.md` — the API contract (`initVitals({ endpoint, siteId, sampleRate? })` and nothing else in v1), concepts to read first (web-vitals package, PerformanceObserver, sendBeacon vs fetch keepalive, visibilitychange/pagehide, ESM vs CJS, what tsup does), acceptance criteria, known pitfalls (iOS pagehide quirks, losing the final INP, double-flush)
- [ ] Claude Code (optional, if Lakhte wants it): failing acceptance tests in `lib/vitals-client/test/`, clearly headed as scaffolding
- [ ] Lakhte: implement capture (LCP, CLS, INP, TTFB, FCP + path, coarse device class, connection type when present), batching, and flush on visibilitychange/pagehide via sendBeacon with fetch fallback
- [ ] Lakhte: build config (tsup or equivalent → ESM + CJS + d.ts, `sideEffects: false`), `lib/vitals-client/CHANGELOG.md` from 0.1.0, library README with the two-line integration snippet
- [ ] Claude Code: written review in `docs/learning/03-library-review.md`; Lakhte revises until both are satisfied
- [ ] Dashboard dogfoods the library in dev (its own sessions appear) — wiring it in is Lakhte's too (one script, good practice)
- DoD: `npm pack` produces a clean tarball; built size recorded in README
  (measured); dogfooding works; review notes resolved. Chapter 03 is the brief
  + review + a closing section Lakhte writes himself in his own words: what he
  learned, what surprised him.

### M4 — GraphQL analytics API (the DataLoader showpiece — do this carefully)
- [ ] Query-count instrumentation first: a committed counter (Drizzle logger or driver wrap) usable in tests
- [ ] Aggregates: per-page p75 (and p50/p90) per metric over a time range; rating buckets per web.dev thresholds; site-level rollup
- [ ] Implement `Page.metrics` naively; record the measured N+1 count in README's metrics table
- [ ] Convert to DataLoader via `@pothos/plugin-dataloader`; record the after count; add a regression test pinning the batched count
- [ ] Second batched relation (e.g. `Session.pageviews`) to show it generalizes
- [ ] README "Decisions" entry: DataLoader vs aggregate-at-the-root SQL, with the tradeoff honestly stated (SQL could do this in one query; the point is demonstrating the general pattern, and the entry should say so)
- [ ] Chapter 04: the N+1 problem from first principles — walk the naive resolver's query log line by line, then exactly what DataLoader batches and when; this chapter doubles as Lakhte's interview prep for the most-asked GraphQL question
- DoD: metrics table filled with measured before/after numbers and method
  linked; regression test green; chapter 04 done.

### M5 — Typed operations + schema snapshot
- [ ] GraphQL Codegen for client operations (typed hooks or typed documents; pick one, log the decision)
- [ ] Commit a generated `schema.graphql` snapshot; CI step regenerates and fails on drift
- [ ] Migrate client queries to generated types; delete hand-written operation types
- [ ] Chapter 05: what codegen generates and why the snapshot-drift CI check exists
- DoD: no hand-rolled operation types on the client; CI fails on snapshot
  drift; chapter 05 done.

### M6 — Dashboard UI + Storybook
Hand-rolled components, minimal consistent design (CSS modules or
vanilla-extract; log the decision). No component library dependency. Charts
hand-rolled SVG or a micro-lib (log the decision; no heavyweight chart
frameworks).
- [ ] Components: `MetricCard` (p75 + rating color per web.dev thresholds), `TimeSeriesChart`, `PagesTable`, `SessionsTable`, `FilterBar` (time range, device, connection)
- [ ] Storybook configured for Next.js; a story per component including edge states (empty, loading, all-poor ratings, long paths, huge values)
- [ ] Interaction tests (play functions) for FilterBar and PagesTable sorting at minimum; `@storybook/test-runner` wired into CI
- [ ] A11y addon enabled; fix what it flags
- [ ] Chapter 06: component boundaries (why these five), what Storybook stories/play functions are for, how the interaction tests differ from e2e
- DoD: `npm run storybook` works; every component above has stories; at least
  two interaction tests pass in CI; chapter 06 done.

### M7 — App Router depth: streaming SSR + RSC boundaries
- [ ] Integrate `@apollo/client-integration-nextjs`; first paint of the overview streams from the server, filters/interactions stay client-side
- [ ] Explicit, minimal server/client split ("use client" only where interaction demands it); short README section documenting the boundary
- [ ] Suspense loading UI matching final layout (no layout shift — this app of all apps must not ship CLS)
- [ ] e2e asserts the overview renders with JS disabled (initial HTML contains seeded aggregates)
- [ ] Chapter 07: RSC vs client components from first principles, what streams and when, what hydration is, why the no-JS test proves the SSR claim
- DoD: server-rendered HTML carries real content, verified by e2e; decision
  entry on the integration approach; chapter 07 done.

### M8 — Performance on itself (the self-referential showpiece)
- [ ] Stress seed behind a flag (~100k metric events across ~2k sessions); virtualize SessionsTable and PagesTable (TanStack Virtual or hand-rolled; log the decision); measure render before/after with a committed method
- [ ] Self-instrumentation in production mode: the dashboard loads its own built library and reports into itself; a small "This site, measured by itself" panel shows the dashboard's own p75s
- [ ] Bundle budget: record the dashboard route's first-load JS; CI fails if it exceeds baseline + 10%
- [ ] All measured numbers in README's metrics section
- [ ] Chapter 08: what virtualization actually does, how the measurements were taken, how to read the bundle analysis, and how the self-instrumentation loop works end to end (Lakhte's library → collect → GraphQL → panel)
- DoD: every number measured with committed method; CI enforces the budget;
  the self-measurement panel shows real collected data; chapter 08 done.

### M9 — Accessibility pass
- [ ] axe checks in Playwright (`@axe-core/playwright`) on overview + a detail view, zero serious/critical violations
- [ ] Full keyboard path e2e: change filters, sort the pages table, open a session without a mouse
- [ ] Charts have non-visual equivalents (data table fallback or aria summary); visible focus states throughout
- [ ] Chapter 09: what axe catches and what it cannot, the keyboard-path reasoning, how the chart fallbacks work
- DoD: axe e2e green in CI; keyboard e2e green; chapter 09 done.

### M10 — Deploy + demo mode
- [ ] Decide hosting for a single-tenant SQLite app (likely Vercel + demo mode: ephemeral seeded DB per cold start, "demo data resets" banner; alternative libSQL/Turso). Write the decision entry BEFORE building
- [ ] Deploy; seeded demo + self-instrumentation live at a public URL; GraphiQL disabled or read-only in demo; /api/collect rate-capped in demo
- [ ] README: live demo link at top, badge `<USER>` swapped to `lakhtea`, screenshots heavy on substance
- [ ] Chapter 10: the deploy decision explained, what demo mode isolates and why, what would change for real multi-user hosting
- DoD: public URL works from a clean browser; the self-measurement panel is
  live; chapter 10 done.

### M11 — Public polish (last)
- [ ] README final pass: architecture diagram accurate, every Decisions entry present, metrics tables complete, no TBDs left
- [ ] Build-story section drafted for the README — the honest account: AI-assisted by design, library human-written, everything human-reviewed and explained in docs/learning. Draft it, then get Lakhte's sign-off on the framing before it lands
- [ ] `docs/learning/99-use-as-template.md`: how to reuse this repo as a starter — which files are the skeleton, which are the domain, the order to replace things in
- [ ] `LICENSE` sanity check; GitHub repo description + topics suggestions listed in the Session Log for Lakhte
- [ ] Lakhte creates github.com/lakhtea/vitals and pushes (HE pushes; Claude Code prepares everything but never creates accounts or pushes to a remote it was not given); npm publish of the library is likewise his
- DoD: `git log` tells a coherent story; a stranger can clone, seed, run, and
  understand every claim in the README within ten minutes; Lakhte can do the
  same AND explain any file a stranger points at, using the learning chapters.

## Working agreements for long autonomous runs

- Work milestones strictly in order; within a milestone, checkboxes in order
  unless a blocker forces a swap (note the swap in the Session Log). M3 is the
  standing exception: if Lakhte isn't actively working it, write the brief and
  move on; revisit for review when he has code.
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

The canonical, always-current list is `docs/NEEDS-LAKHTE.md`. Summary:

- M3 implementation (his build — brief will be ready first).
- M10 hosting account (Vercel or similar) when M10 starts.
- M11 GitHub repo creation + push, npm publish of the library, and sign-off
  on the README build-story framing (Lakhte's accounts and voice).

## Session Log

Append one short entry per session: date, items completed, measurements taken,
decisions logged, anything blocked.

- 2026-10-08 — Repo created from the verified-green pipeline scaffold, then
  REPOINTED from job tracker to Vitals (RUM kit): the owner already ships a
  tracker (separate private repo), so the domain changed while the skill
  targets stayed. README/PLAN/CLAUDE rewritten; package renamed to "vitals";
  folder renamed Desktop/vitals.
- 2026-10-08 (later) — Plan upgraded to a teaching build at Lakhte's request:
  Teaching Contract added (learning chapter per milestone, TOUR.md, glossary,
  file headers, template chapter), pairing contract added (M3 browser library
  is Lakhte-built, Claude Code coaches and reviews only — his choice), M0
  gains the orientation chapter on the existing skeleton. Next: M0.
- 2026-10-07 (evening, Claude Code) — M0 complete. Fresh `npm ci` on npm 11
  blocked better-sqlite3's native build (npm's new allow-scripts gate), fixed
  by committing `allowScripts` in package.json; Node 24 has no prebuilt
  better-sqlite3 binary so it compiles from source (noted in
  docs/NEEDS-LAKHTE.md). Playwright browser build reinstalled to match
  @playwright/test 1.62.1. All four checks green locally; CI runs the same
  scripts (added `.nvmrc`/`engines` = Node 22 to match CI). vitest.config
  renamed to `.mts` to silence Vite's ESM-in-CJS warning. Added `web-vitals`
  (source of truth for rating thresholds) and `zod` (boundary validation)
  ahead of M1/M2. Teaching layer bootstrapped: chapter 00, TOUR.md,
  GLOSSARY.md. Created docs/NEEDS-LAKHTE.md as the single owner-task list.
  TESTING_RULES.md (Lakhte's) committed. Session hard stop: 01:50 Eastern,
  2026-10-08. Next: M1.
- 2026-10-07 (late evening, Claude Code) — M1 complete. Tracker domain
  deleted; four-table RUM schema (sites, sessions, pageviews, metric_events)
  with drizzle-kit migrations applied at open (`drizzle/0000_rum_domain.sql`),
  foreign keys on, dedupe unique index on (pageview, name, metric_id).
  Deterministic seeded-PRNG synthetic traffic (50 sessions / 10 paths,
  log-normal timings, CLS mixture, INP on ~70% of pageviews, Safari/Firefox
  report connection "unknown"); idempotent via sender-chosen ids + ON
  CONFLICT DO NOTHING, proven by test (seed twice, counts equal). GraphQL:
  Site, Page (aggregate), `sites`/`site`/`pages`. Env var renamed
  VITALS_DB_PATH; Playwright deletes its DB before seeding. Tests per
  TESTING_RULES: 5 unit (threshold edges inclusive, seed idempotent + ratings
  consistent, page counts add up, root ordering) + 1 e2e. Decisions logged:
  migrations, idempotency mechanism, thresholds from web-vitals, epoch-ms
  timestamps. Chapter 01 written; TOUR + glossary updated. Next: M2.
- 2026-10-07 (night, Claude Code) — M2 complete. `POST /api/collect` in
  `src/collect/` (zod payload contract built per request so "not in the
  future" uses a clock; transaction with conflict-ignoring inserts; typed
  error codes invalid_json 400 / invalid_payload 422 with issue paths /
  batch_too_large + payload_too_large 413 / unknown_site 404; 202 returns
  {inserted, duplicates}); text body accepted without content-type and open
  CORS + OPTIONS so sendBeacon works cross-origin; rating recomputed
  server-side; MAX_PLAUSIBLE_VALUE per metric added to src/vitals/metrics.
  Caps documented: 25 events, 64 KB. Tests: 9 unit in handle.test.ts (happy
  path + session reuse, exact duplicate delivery, six rejections that store
  nothing, CORS) + e2e collect.spec.ts (posted batch appears on dashboard).
  README gained the payload example + status table and a decision entry.
  Chapter 02, TOUR, glossary updated. Next: M3 brief (Lakhte's build), then
  M4.
