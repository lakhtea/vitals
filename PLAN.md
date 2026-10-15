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

Amended 2026-10-14: the product has two tiers.
Tier one is the RUM kit above, extended with health checks that any application can push and with deterministic incident detection, so the dashboard is the on-call engineer's single human-facing view.
Tier two, optional to deploy, is a set of on-call triage agents: four single-responsibility agents (summarize, propose a fix, review, open the PR) that read incidents from the dashboard, write every step back as evidence, and stop at a mandatory human gate before anything leaves the repo.
At that gate the reviewer sees the proposed change as a diff and can make small edits in the dashboard before approving; it edits only what the agent proposed and is not a code editor for the repo.
The dashboard is for humans; the agents are external workers, and the Next.js app never calls a model.
This is the public counterpart of an on-call triage pipeline Lakhte built at a previous job (code not public), and it adds to the skill list above: multi-agent orchestration with explicit human gates, tool design over MCP, evals before autonomy, and containerised deployment.

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
- Tier two (M13 to M15): `@modelcontextprotocol/sdk` for the MCP server, `@anthropic-ai/claude-agent-sdk` for the triage worker, Docker for the worker image; none of these is a dependency of the Next.js app, which talks to agents only through GraphQL. The fix review editor (M14) adds CodeMirror 6 (`@codemirror/*`) and the `diff` package to the app, loaded only on the incident route.

## Hard guardrails

1. **Scope (amended 2026-10-14, see Session Log):** two tiers.
   Tier one, the RUM kit: Core Web Vitals (LCP, CLS, INP, TTFB, FCP) by page, device class, and connection type; sessions; percentile aggregates; the collection library; health checks pushed by any application; deterministic incident detection with a human approve/dismiss gate.
   Tier two, the triage agents: an external worker that reads incidents over MCP and writes its steps back.
   The Next.js app never calls a model, and no agent action leaves the repo without the human gate.
   Still excluded: error tracking, session replay, paging and notification channels (detection yes, paging no), multi-tenant auth, AI features inside the dashboard itself.
   If a feature idea appears mid-session, add one line to "Parked ideas" at the bottom instead of building it.
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
- [x] Claude Code: write `docs/learning/03-library-brief.md` — the API contract (`initVitals({ endpoint, siteId, sampleRate? })` and nothing else in v1), concepts to read first (web-vitals package, PerformanceObserver, sendBeacon vs fetch keepalive, visibilitychange/pagehide, ESM vs CJS, what tsup does), acceptance criteria, known pitfalls (iOS pagehide quirks, losing the final INP, double-flush)
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
- [x] Query-count instrumentation first: a committed counter (Drizzle logger or driver wrap) usable in tests
- [x] Aggregates: per-page p75 (and p50/p90) per metric over a time range; rating buckets per web.dev thresholds; site-level rollup
- [x] Implement `Page.metrics` naively; record the measured N+1 count in README's metrics table
- [x] Convert to DataLoader via `@pothos/plugin-dataloader`; record the after count; add a regression test pinning the batched count
- [x] Second batched relation (e.g. `Session.pageviews`) to show it generalizes
- [x] README "Decisions" entry: DataLoader vs aggregate-at-the-root SQL, with the tradeoff honestly stated (SQL could do this in one query; the point is demonstrating the general pattern, and the entry should say so)
- [x] Chapter 04: the N+1 problem from first principles — walk the naive resolver's query log line by line, then exactly what DataLoader batches and when; this chapter doubles as Lakhte's interview prep for the most-asked GraphQL question
- DoD: metrics table filled with measured before/after numbers and method
  linked; regression test green; chapter 04 done.

### M5 — Typed operations + schema snapshot
- [x] GraphQL Codegen for client operations (typed hooks or typed documents; pick one, log the decision)
- [x] Commit a generated `schema.graphql` snapshot; CI step regenerates and fails on drift
- [x] Migrate client queries to generated types; delete hand-written operation types
- [x] Chapter 05: what codegen generates and why the snapshot-drift CI check exists
- DoD: no hand-rolled operation types on the client; CI fails on snapshot
  drift; chapter 05 done.

### M6 — Dashboard UI + Storybook
Hand-rolled components, minimal consistent design (CSS modules or
vanilla-extract; log the decision). No component library dependency. Charts
hand-rolled SVG or a micro-lib (log the decision; no heavyweight chart
frameworks).
- [x] Components: `MetricCard` (p75 + rating color per web.dev thresholds), `TimeSeriesChart`, `PagesTable`, `SessionsTable`, `FilterBar` (time range, device, connection)
- [x] Storybook configured for Next.js; a story per component including edge states (empty, loading, all-poor ratings, long paths, huge values)
- [x] Interaction tests (play functions) for FilterBar and PagesTable sorting at minimum; `@storybook/test-runner` wired into CI
- [x] A11y addon enabled; fix what it flags
- [x] Chapter 06: component boundaries (why these five), what Storybook stories/play functions are for, how the interaction tests differ from e2e
- DoD: `npm run storybook` works; every component above has stories; at least
  two interaction tests pass in CI; chapter 06 done.

### M7 — App Router depth: streaming SSR + RSC boundaries
- [x] Integrate `@apollo/client-integration-nextjs`; first paint of the overview streams from the server, filters/interactions stay client-side
- [x] Explicit, minimal server/client split ("use client" only where interaction demands it); short README section documenting the boundary
- [x] Suspense loading UI matching final layout (no layout shift — this app of all apps must not ship CLS)
- [x] e2e asserts the overview renders with JS disabled (initial HTML contains seeded aggregates)
- [x] Chapter 07: RSC vs client components from first principles, what streams and when, what hydration is, why the no-JS test proves the SSR claim
- DoD: server-rendered HTML carries real content, verified by e2e; decision
  entry on the integration approach; chapter 07 done.

### M8 — Performance on itself (the self-referential showpiece)
- [x] Stress seed behind a flag (~100k metric events across ~2k sessions); virtualize SessionsTable and PagesTable (TanStack Virtual or hand-rolled; log the decision); measure render before/after with a committed method
- [ ] Self-instrumentation in production mode: the dashboard loads its own built library and reports into itself; a small "This site, measured by itself" panel shows the dashboard's own p75s
- [x] Bundle budget: record the dashboard route's first-load JS; CI fails if it exceeds baseline + 10%
- [x] All measured numbers in README's metrics section
- [x] Chapter 08: what virtualization actually does, how the measurements were taken, how to read the bundle analysis, and how the self-instrumentation loop works end to end (Lakhte's library → collect → GraphQL → panel)
- DoD: every number measured with committed method; CI enforces the budget;
  the self-measurement panel shows real collected data; chapter 08 done.

### M9 — Accessibility pass
- [x] axe checks in Playwright (`@axe-core/playwright`) on overview + a detail view, zero serious/critical violations
- [x] Full keyboard path e2e: change filters, sort the pages table, open a session without a mouse
- [x] Charts have non-visual equivalents (data table fallback or aria summary); visible focus states throughout
- [x] Chapter 09: what axe catches and what it cannot, the keyboard-path reasoning, how the chart fallbacks work
- DoD: axe e2e green in CI; keyboard e2e green; chapter 09 done.

### M10 — Deploy + demo mode
- [x] Decide hosting for a single-tenant SQLite app (likely Vercel + demo mode: ephemeral seeded DB per cold start, "demo data resets" banner; alternative libSQL/Turso). Write the decision entry BEFORE building
- [ ] Deploy; seeded demo + self-instrumentation live at a public URL; GraphiQL disabled or read-only in demo; /api/collect rate-capped in demo
- [ ] README: live demo link at top, badge `<USER>` swapped to `lakhtea`, screenshots heavy on substance
- [x] Chapter 10: the deploy decision explained, what demo mode isolates and why, what would change for real multi-user hosting
- DoD: public URL works from a clean browser; the self-measurement panel is
  live; chapter 10 done.

### M12 - Incidents and health checks (tier one: the human on-call view)
Scope amended 2026-10-14.
The dashboard becomes the single human-facing record of what is wrong: vitals regressions and failing health checks open incidents, a human approves or dismisses them, and from M15 each agent's work appears on the same page.
- [x] Decision entries BEFORE building: deterministic detection (baseline window vs current window, minimum sample counts, web.dev band changes) over anomaly models; health checks pushed by the application (one pull adapter follows in M13) over per-app pull connectors; a per-site write key for `/api/checks` while `/api/collect` stays open for browsers
- [x] Drizzle schema + migrations: `checks` (site, check id, name, status OK|DEGRADED|FAILING, value, unit, observed_at, detail); `incidents` (site, source WEB_VITALS|HEALTH_CHECK, path or check id, metric, detected_at, resolved_at, evidence: baseline p75, current p75, sample counts, or status before/after; status OPEN|TRIAGED|FIX_PROPOSED|REVIEWED|AWAITING_HUMAN|APPROVED|DISMISSED|RESOLVED; note); `incident_steps` (incident, role SUMMARIZE|PROPOSE_FIX|REVIEW|OPEN_PR|HUMAN, status, started_at, finished_at, summary, detail, model, input and output tokens, cost, link)
- [x] `POST /api/checks`: any application pushes a batch of check results; Zod-validated with typed errors, idempotent on (site, check id, observed_at), rejected without the site's write key, batch cap documented like collect
- [x] Detector as a pure function over the two windows plus a `detectIncidents(siteId, now)` entry point (`npm run incidents:detect` and a GraphQL mutation). Vitals: per (page, metric), open an incident when the rating band worsens or p75 rises past a documented relative threshold, only when both windows meet the minimum sample count. Checks: open when the latest status is FAILING, or DEGRADED for N consecutive observations. One open incident per (site, source, path or check, metric); an OPEN incident whose condition has cleared for a full window is marked RESOLVED; human decisions are never overwritten
- [x] Seed: one synthetic vitals regression (a page whose LCP band worsens in the latest window) and one failing check, idempotent as always, so the detector has something real to find; the stress seed stays detector-clean
- [x] GraphQL: `Site.checks`, `Site.incidents(status)`, `incident(id)` with `evidence` and `steps`; mutations `detectIncidents(siteId)`, `approveIncident(id, note)`, `dismissIncident(id, note)` with state-machine validation (illegal transitions are typed errors); schema snapshot and codegen updated
- [x] UI: `HealthPanel` (latest status per check beside the metric cards), `IncidentsTable` on the overview, and the first detail route `/incidents/[id]`, server-rendered like the overview: evidence (baseline vs current, sample counts), a steps timeline (empty until M13), approve and dismiss with a note. The device and connection breakdown moved to M13, where `get_incident_context` computes it for the agents and the detail page can show the same numbers. The M9 keyboard path now ends inside a detail view. Stories for the new components including empty, resolved, and long-note states
- [x] Tests per TESTING_RULES: detector behaviour table (fires on band change, stays quiet under minimum samples, idempotent re-run, resolves when cleared, never touches APPROVED or DISMISSED); checks endpoint contract (happy, malformed, missing key, duplicate delivery); e2e: the seeded regression appears as an incident and a human dismisses it by keyboard; axe on the detail view
- [x] Chapter 12: detection as statistics (why p75 deltas need minimum samples, why a baseline window, why a blip is not an incident), the incident state machine and who may move it, why checks are push-first, what the write key protects against
- DoD: `npm run db:seed && npm run incidents:detect` opens exactly two incidents; the detail page shows the evidence and takes a decision; re-running the detector changes nothing; chapter 12, TOUR, and glossary done; green tree including e2e.

### M13 - Agent connection (MCP server + service auth)
The agents are external.
This milestone is the boundary they cross: a service token for the mutations only agents call, and an MCP server whose tools are thin wrappers over the GraphQL schema.
Nothing here calls a model.
- [ ] Decision entries BEFORE building: MCP tools as 1:1 wrappers over GraphQL operations (over a second bespoke API); the MCP server talks to the dashboard over HTTP with a service token (over in-process SchemaLink) because the worker runs in another container; approve and dismiss stay unauthenticated in single-tenant v1 while agent mutations require the token
- [ ] Service token: `VITALS_SERVICE_TOKEN`; `recordStep(incidentId, role, status, summary, detail, usage, link)` and `transitionIncident(id, to)` require `Authorization: Bearer`; a missing or wrong token is a typed GraphQL error; transitions validated by the M12 state machine
- [ ] `services/vitals-mcp`: a stdio MCP server on `@modelcontextprotocol/sdk` exposing `list_open_incidents`, `get_incident_context` (evidence, breakdowns, a recent-sessions sample, check history, the human's notes), `record_step`, and `request_human_review`; inputs and outputs typed from the generated GraphQL documents; a committed `.mcp.json` so Claude Code in this repo can call the tools
- [ ] HTTP health-probe adapter: `npm run checks:probe -- --site <id> --url <url>` fetches any `/healthz`-style endpoint and posts a check result through `/api/checks`; proves the checks API against an application we do not control
- [ ] Incident detail renders each recorded step as evidence: what the agent saw, what it concluded, model, tokens, cost, latency, link; the human gate shows "awaiting your review" when the pipeline stops
- [ ] Tests per TESTING_RULES: token enforcement (none, wrong, right), transition validation, each MCP tool's contract against a test server; e2e: a scripted agent records a step over MCP and the detail page shows it; the probe adapter against a local fixture endpoint
- [ ] Chapter 13: what MCP is (protocol, transports, tools vs resources), why the tools are thin over GraphQL, service tokens vs user auth, why the app still never calls a model
- DoD: from Claude Code with the committed `.mcp.json`, `list_open_incidents` returns the seeded regression and `record_step` appears on its detail page; green tree including e2e.

### M14 - Fix review: see and edit the proposed change
The human gate is not a yes/no button.
The reviewer sees the agent's proposed change as a diff and can make small edits in place before approving (a timeout from five seconds to ten, a message, a threshold) without leaving the dashboard.
It edits only what the agent proposed; it is not a code editor for the repo.
- [ ] Decision entries BEFORE building: the proposed change stored as a base commit SHA plus per-file before and after contents, with the diff derived, over a hand-edited unified diff; CodeMirror 6 over Monaco (size, modularity, keyboard accessibility) and over a plain textarea, loaded only on the incident route; revisions immutable, so every human edit is a new revision and a HUMAN step
- [ ] Drizzle schema + migrations: `fix_revisions` (incident, number, author AGENT|HUMAN, created_at, target repo, base_sha, summary) and `fix_revision_files` (revision, path, action ADD|MODIFY|DELETE, before_content, after_content); documented caps on file size and file count per revision, enforced in validation
- [ ] GraphQL: `Incident.fixRevisions`, `FixRevision.files`, `FixRevision.diff` (server-computed unified diff via the `diff` package); mutations `submitFixRevision(incidentId, baseSha, summary, files)` (service token; the worker's path in M15) and `editFixRevision(revisionId, files, note)` (human; writes a new HUMAN revision and a HUMAN step); `approveIncident` now pins a `revisionId`; schema snapshot and codegen updated
- [ ] MCP: `submit_fix` tool added to `services/vitals-mcp`, typed like the rest
- [ ] A committed, flag-gated regression: `VITALS_DEMO_REGRESSION=1` makes the overview await a simulated slow upstream call with no timeout, so TTFB and LCP worsen for real; the seed adds an AGENT revision that wraps that call in a `5_000` ms timeout with a fallback. This is what the editor demo edits until the M15 worker produces revisions for real, and what the M15 fix agent has to find
- [ ] UI on `/incidents/[id]`: a "Proposed change" panel with the file list and a read-only unified diff per file, server-rendered so it is in the no-JS HTML; an Edit action opens that file's after-content in CodeMirror 6 (highlighting for TS, JS, CSS, JSON, Markdown) loaded with `next/dynamic` on this route only; Save writes a new revision, the diff re-renders, and the revision history shows who changed what; an "edited since last review" badge until a REVIEW step covers the latest revision; stories for the panel (one file, many files, add and delete, oversized file, edited badge)
- [ ] Bundle budget: the "/" baseline must not move; a second baseline for the incident route is recorded and checked in CI under the same +10% rule, with the editor's cost stated in the README metrics table
- [ ] Accessibility: the editor is reachable and operable by keyboard (CodeMirror's own bindings), focus returns to the file list on save or cancel, axe on the detail view with the editor open
- [ ] Tests per TESTING_RULES: revision creation (agent submit, human edit makes a new revision and a HUMAN step, caps enforced, base SHA required); diff rendering for add, modify, delete; approve pins a revision and rejects one from another incident; e2e: on the seeded incident, change `5_000` to `10_000` in the editor, save, see the diff update, approve by keyboard
- [ ] Chapter 14: how a change is represented (base SHA plus contents vs a unified diff, and why a git patch needs a base), what a diff algorithm does, how CodeMirror 6's state and view model works, why the editor is lazy-loaded and how the bundle budget sees it, why revisions are immutable
- DoD: on the seeded incident a human changes the timeout in the browser, the diff updates, approving pins that revision; keyboard-only works; the "/" budget is unchanged and the incident-route budget recorded; chapter 14, TOUR, and glossary done; green tree including e2e.

### M15 - Triage worker (tier two: the four agents)
The showpiece of tier two: four single-responsibility agents that take an incident from OPEN to AWAITING_HUMAN, and open the PR only after a human approves.
Runs anywhere a container runs; ECS is the target.
- [ ] Decision entries BEFORE building: the worker on the Claude Agent SDK over the Anthropic SDK tool runner and over Managed Agents (the tool layer stays harness-neutral so Managed Agents remains a swap); polling the dashboard over webhooks for v1; four narrow agents over one
- [ ] `services/triage-worker`: own package.json; four agent definitions (`agents/summarize.md`, `propose-fix.md`, `review.md`, `open-pr.md`), each a prompt plus an allowed-tool list: summarize gets only the dashboard MCP tools; propose-fix adds read, edit, and shell inside a fresh clone of the target repo; review gets read, search, and shell to run the tests; open-pr gets shell with `gh`. A runner polls open incidents, runs the pipeline one incident at a time, records every step through MCP, submits the proposed change as a fix revision through `submit_fix`, stops at AWAITING_HUMAN, and resumes APPROVED incidents to open the PR from the approved revision; a HUMAN revision with no REVIEW step is re-reviewed (tests run) first, and a failure returns the incident to AWAITING_HUMAN with the failure recorded
- [ ] Run-away guards: per-incident token and cost budget, max turns per agent, one incident per worker at a time, idempotent resume (a restarted worker reads the recorded steps and continues from the last finished one), every failure recorded as a step
- [ ] Container: `Dockerfile`, `compose.yaml` running dashboard + worker locally, an ECS task definition and a short runbook; secrets only through env (`ANTHROPIC_API_KEY`, `VITALS_SERVICE_TOKEN`, `GH_TOKEN`)
- [ ] Recorded run: run the pipeline once for real against the seeded incident and commit the resulting steps and fix revision as a fixture the demo seed loads, labelled "recorded run" in the UI, with the method documented; the Vercel demo shows this because the worker does not deploy there
- [ ] Evals before autonomy: a golden set of seeded incidents (a true regression, noise under the minimum samples, a failing check, a flapping check) with expected summarizer classifications and reviewer verdicts; `npm run eval:triage` scores them; CI runs the eval against recorded fixtures without a key, live mode by hand; results table in README
- [ ] Observability: per-step model, tokens, cost, and latency in `incident_steps`; the README metrics table gains measured cost and wall time per incident
- [ ] Chapter 14: why four narrow agents instead of one, where the human gate sits and why, how the loop is stopped from running away, how to eval a trajectory rather than a final answer, what would change under Managed Agents; written as the interview answers
- DoD: `docker compose up` runs dashboard + worker locally; the seeded regression goes OPEN to AWAITING_HUMAN with four recorded steps; approving in the UI makes the worker open a PR from the approved revision, edited or not, against a repo Lakhte designates (or write the branch and patch locally until there is a remote); evals green in CI; chapter 14, TOUR, and glossary done.

### M11 — Public polish (last)
- [ ] README final pass: architecture diagram accurate (both tiers, the worker, and the MCP boundary), every Decisions entry present, metrics tables complete, no TBDs left
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
- Detector rules revisit: a per-metric sample floor or a confidence interval
  on the p75 (CLS fired four false incidents on stationary stress traffic, see
  chapter 12), and an absolute-change rule so a zero CLS baseline can still
  regress. Measure before and after on the stress data.

## Blocked / needs Lakhte

The canonical, always-current list is `docs/NEEDS-LAKHTE.md`. Summary:

- M3 implementation (his build — brief will be ready first).
- M10 hosting account (Vercel or similar) when M10 starts.
- M11 GitHub repo creation + push, npm publish of the library, and sign-off
  on the README build-story framing (Lakhte's accounts and voice).
- M15 triage worker: an Anthropic API key for live runs (recorded fixtures
  cover CI), a GitHub token and a target repo for the PR agent (after M11's
  push), and an AWS account with ECS when the worker is hosted; `docker
  compose` covers local runs.

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
- 2026-10-07 (night, Claude Code) — M3 brief written (Lakhte's build; skipped
  per contract) and M4 complete in two commits so git shows before/after.
  QueryCounter (Drizzle logger through makeDb) + `npm run measure:queries`
  (`-- --verbose` prints statements). Percentiles via SQLite window
  functions, nearest-rank (value at rank ceil(p*n)), half-open [from, to)
  DateTime range, rating buckets, site rollup. MEASURED: `site { pages {
  metrics } }` 12 statements naive (2+N, N=10) -> 3 with
  `t.loadableList` + cacheKeyFn on (site, path, range); `site { sessions(20)
  { pageviews } }` 3 statements. Both pinned by tests (red against naive
  first). DateTime scalar (Int is 32-bit), MetricRating/DeviceClass/
  ConnectionType enums (no hyphens in GraphQL enum values). Decision entry
  DataLoader vs root SQL written honestly. Chapter 04, TOUR, glossary. Not
  batched on purpose: Site.pages across sites (named as the chapter's
  exercise). Next: M5.
- 2026-10-07 (night, Claude Code) — M5 complete. `scripts/print-schema.ts`
  writes a lexicographically sorted `schema.graphql`; GraphQL Codegen
  `client` preset (typed documents, fragment masking off; decision logged)
  generates `src/graphql/generated/`; page.tsx uses `graphql()` and its
  hand-written result interface is gone. Drift guards: a unit test compares
  the committed snapshot to the live schema, and CI runs `npm run
  codegen:check` (regenerate + `git diff --exit-code`). Generated code is
  lint-ignored and coverage-excluded. Chapter 05, TOUR, glossary. Next: M6.
- 2026-10-07 (late night, Claude Code, multi-agent) — M6 complete: five
  CSS-Modules components in src/dashboard with stories (16 story tests incl.
  two play functions, axe per story with violations as failures) via
  Storybook 10 nextjs-vite + addon-vitest as a second Vitest project
  (decision: addon-vitest over test-runner, logged); page composed with one
  TrafficFilter variable; DateTime scalar mapped to string in codegen; axe
  caught the create-next-app `overflow-x: hidden` body rule (removed).
  Decisions logged: CSS Modules + hand-rolled SVG, TrafficFilter windowed on
  pageview start, addon-vitest. PREPARED AHEAD (swap noted, boxes not
  ticked until their milestone): M8 stress seed (`npm run db:seed:stress`,
  measured 2,000 sessions / 21,265 pageviews / 100,136 events in 0.8s,
  idempotent), M10 demo mode (VITALS_DEMO_MODE=1: tmp-dir DB seeded on open,
  GraphiQL off, collect rate limit 120/min/site -> 429, banner, drizzle/
  traced into serverless output; `next build` verified), M7 Apollo modules
  (src/app/apollo: ApolloNextAppProvider wrapper, RSC client over SchemaLink,
  verified in-process with no HTTP hop). Draft chapters 07-10 and 99 written
  (concept sections; file lists filled when each milestone lands). Next: M7
  wiring (page -> server component + PreloadQuery, no-JS e2e), then M9.
- 2026-10-07/08 (final hour, Claude Code, multi-agent) — M7 complete:
  page.tsx is a Server Component (connection() for per-request render,
  awaited data via RSC Apollo client over SchemaLink, props to a client
  DashboardView, useQuery only on change; UTC dates for hydration
  determinism). Decision logged: awaited props over PreloadQuery streaming
  (React outlines completed Suspense boundaries > ~12.8 KB behind an inline
  script, so no-JS visitors would see the fallback forever; measured on the
  HTML). e2e/ssr.spec.ts (JS off) proves the SSR claim; 0 GraphQL requests
  on load, 0 hydration warnings. M8 code complete: bundle budget (final
  baseline 689,831 B raw for "/", CI job `bundle`, +10%), virtualised
  SessionsTable (2,001 -> 26 rows, 155 -> 91 ms median, committed
  measure-render.ts), stress seed; the self-measurement panel waits on M3.
  M9 complete: axe (0 WCAG 2.1 A/AA violations in two states; gates on
  serious/critical) + keyboard path (typeahead on selects: Chromium/macOS
  opens the popup on ArrowDown); "open a session" has no detail view yet,
  so the path ends at the next control (noted in chapter 09). M10 code
  complete + decision logged; deploy, env vars, and verification steps are
  in docs/NEEDS-LAKHTE.md. M11 prep: build-story draft awaiting sign-off,
  repo description/topics suggested, template chapter 99 drafted. Final
  tree: typecheck, lint, 27 unit, 18 story, 6 e2e, bundle check all green.
  Visual check of the overview done (screenshot reviewed). Blocked on
  Lakhte: M3 library (then dogfooding + self-measurement panel), M10
  account/deploy, M11 push/publish/sign-off.
- 2026-10-08 ~23:40 ET (review round, three agents) — Correctness review of
  the day's work, bugs-only. Seven confirmed and fixed, each with a
  regression case that was red first: DateTime scalar accepted any
  Date.parse input (host-zone-dependent filters) -> strict ISO 8601 with
  offset; sessions(limit: -1) meant "unlimited" in SQLite -> error; ingest
  accepted "/path?token" -> rejected; demo rate-limit key unbounded ->
  capped; DashboardView swallowed query errors -> status line; wrong-site
  flash via Apollo previousData after site switch -> view keeps its own
  last-shown site; site select nested in label -> explicit htmlFor. CI
  simulated job by job locally (no failing step); measure-render.ts
  imported an undeclared package -> fixed; TOUR/chapters 05/06/99 paths
  corrected. Final: lint, typecheck, 31 unit, 18 story, 8 e2e, bundle
  check green; tree clean.
- 2026-10-08 ~23:50 ET — Self-measurement panel built (SelfMeasurementPanel,
  server-rendered from `site(id: "vitals-dashboard")`, honest empty state
  until the M3 library reports); the M8 "self-instrumentation" box stays
  open because its DoD requires real collected data. Final tree: lint,
  typecheck, 33 unit, 20 story, 8 e2e, bundle check green. Session ended
  well before the 01:50 ET stop. Handoff: docs/NEEDS-LAKHTE.md.
- 2026-10-14 ~22:45 ET — Direction change at Lakhte's request: Vitals gains a
  second tier, on-call triage agents, as the public counterpart of the
  four-agent pipeline he built at a previous job. Discussed and decided: the
  dashboard is for humans and the agents are external workers; the Next.js
  app never calls a model; the LLM calls live in a `services/triage-worker`
  container on the Claude Agent SDK with ECS as the target (Managed Agents
  stays a swap; GitHub Actions rejected as the primary runtime; in-app calls
  rejected on timeouts and key exposure); health checks arrive through a
  generic push API so the agents can serve any application; the fix target
  stays this repo. Guardrail 1 rewritten, tiers added to "What this project
  is", M12 to M14 inserted before M11, README scope and two decision entries,
  NEEDS-LAKHTE M12 to M14 section. Docs only, no feature code. Green tree.
- 2026-10-14 ~23:15 ET — Lakhte added, knowing it is heavy, an in-dashboard
  editor at the human gate: the reviewer sees the agent's proposed change as
  a diff and makes small edits in place (a timeout from five seconds to ten)
  before approving; scoped to what the agent proposed, not a repo editor. It
  becomes M14 (fix revisions as base SHA plus file contents, derived diffs,
  CodeMirror 6 lazy-loaded on the incident route, immutable revisions, its own
  bundle baseline). The worker moves to M15 and now submits revisions through
  `submit_fix`, opens the PR from the approved revision, and re-reviews a
  human-edited revision before the PR. The flag-gated demo regression moved
  to M14 so the seeded proposed fix has a real cause. Docs only. Green tree.
- 2026-10-14 23:20 to 2026-10-15 00:30 ET - M12 complete (Lakhte set a 1:30
  ET stop). Built with three parallel agents (detection + seed fixtures,
  checks endpoint + GraphQL, UI components + stories), integrated and
  reviewed in the main session. Shipped: checks / incidents / incident_steps
  tables + sites.write_key (migration 0001), write-key-protected POST
  /api/checks, the pure detector (DETECTION_RULES: 24 h windows, 20-sample
  floor, +50% or +20% with a worse band, failing at once, degraded x3), the
  reconciler, GraphQL Site.checks / Site.incidents / Query.incident and the
  first mutations, the overview's incidents table and health panel, and the
  first detail route /incidents/[id] (server-rendered; the decision form
  calls the mutation then router.refresh()). Measured: a fresh seed + detect
  opens exactly 2 incidents (/pricing p75 LCP 2,861 -> 7,153 ms, api-health);
  "/" First Load JS 728,715 B (+5.6% on the M8 baseline, within budget).
  Found in review and fixed with a test that fails on the old code: the
  reconciler resolved any open vitals regression a day after detection, so a
  persistent regression would close itself once the rolling baseline caught
  up; it now resolves only when the current window shows the p75 back within
  20% of the frozen baseline. Measured and documented, not tuned: the rules
  open 4 false CLS incidents on stationary stress traffic (CLS p75 is
  unstable at tens of samples); the stress traffic now ends before the
  detector's windows and a per-metric floor is parked. The device and
  connection breakdown moved to M13. Final tree: see the commit.
