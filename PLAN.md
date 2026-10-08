# Pipeline — Build Plan

> **Read this first, every session.** This is the working plan for Claude Code.
> Work top-to-bottom through the milestones. Do not skip ahead, do not expand
> scope. Each work session: (1) read this file and README.md, (2) run the
> baseline checks, (3) pick the next unchecked item, (4) build it to its
> Definition of Done, (5) update the checkboxes here, append to the Session Log
> at the bottom, and commit. Leave the tree green.

## What this project is

A job-search tracker (applications, stages, contacts, follow-ups) that the
owner, Lakhte, uses daily during a real job search. It is also deliberate,
demonstrable evidence of specific skills for that search: GraphQL depth
(schema design, resolvers, N+1/DataLoader, cache normalization), Next.js App
Router depth (RSC, streaming SSR), Storybook, frontend performance with real
numbers, and accessibility. Every milestone exists to make one of those claims
honest and demoable. The repo will be public on github.com/lakhtea — write
every file as if a hiring manager will read it, because one will.

## Stack (fixed — do not swap pieces)

- Next.js 16 App Router + React 19, TypeScript strict
- GraphQL: Pothos (code-first) + GraphQL Yoga at `/api/graphql`, DataLoader via `@pothos/plugin-dataloader`
- Client: Apollo Client (normalized cache)
- DB: SQLite via better-sqlite3 + Drizzle ORM (`:memory:` in unit tests)
- Tests: Vitest (unit), Playwright (e2e), GitHub Actions CI (`.github/workflows/ci.yml`)

## Hard guardrails

1. **Scope:** applications, stages, contacts, follow-up dates, and the
   instrumentation/polish milestones below. NO auth providers, NO email
   scraping/integration, NO AI features, NO multi-user. If a feature idea
   appears mid-session, add one line to "Parked ideas" at the bottom instead of
   building it.
2. **Green tree rule:** `npm run typecheck && npm run lint && npm run test`
   must pass before every commit. `npm run test:e2e` must pass before checking
   off any milestone. Never check a box on a red tree.
3. **Honest metrics:** every number in README.md (query counts, bundle sizes,
   web-vitals) must come from an actual measurement made in this repo, with the
   measurement method committed (script, test, or documented command). Never
   estimate, never round a guess into a figure. If a number is not yet
   measured, write TBD.
4. **Tests ride with features:** each mutation/resolver/component lands in the
   same commit as its tests. A milestone's DoD always includes its tests.
5. **Decisions log:** any non-obvious technical choice gets a short entry in
   README "Decisions" using the existing format: problem → options → choice →
   tradeoff. One paragraph, no essays.
6. **Commits:** conventional commits (`feat:`, `fix:`, `test:`, `docs:`,
   `chore:`), small and self-contained. Do not squash unrelated work.
7. **Next.js version caution:** AGENTS.md carries the auto-generated
   `nextjs-agent-rules` block. This Next.js is newer than training data: check
   `node_modules/next/dist/docs/` before using an App Router API you have not
   verified in this repo.

## Milestones

### M0 — Baseline verification (every fresh clone / first session)
- [ ] `npm install` clean; `npm run db:seed` idempotent (run twice, verify no dupes)
- [ ] `npm run typecheck`, `lint`, `test`, `test:e2e` all green locally
- [ ] CI workflow runs the same four checks; fix any drift between CI and local
- DoD: all checks green, one `chore:` commit if anything needed fixing.

### M1 — Mutations (the core write path)
One mutation per work block, each with: Pothos mutation field + input type,
Drizzle write, unit tests (happy path + at least two failure/edge cases, run
against `:memory:` SQLite), Apollo `useMutation` wired into the UI with cache
update (prefer `cache.modify`/`update` over refetch; document why if refetch).
- [ ] `updateApplicationStage(applicationId, stage)` — stage is the existing enum; moving to an interview stage must not silently clear follow-ups
- [ ] `setFollowUp(applicationId, date | null)` — null clears; reject past dates with a typed error the UI renders inline
- [ ] `addContact(applicationId, { name, role?, email?, linkedin? })` — at least name required; dedupe by (applicationId, name) with a clear error
- [ ] `addApplication({ company, role, url?, stage?, appliedAt? })` — defaults stage sensibly; URL validated
- [ ] Optimistic UI for stage changes (the highest-frequency action), with rollback on error, e2e-tested
- DoD: all four mutations usable from the UI, each unit-tested, one e2e flow
  covering add application → change stage → set follow-up → add contact.

### M2 — N+1 and DataLoader (the showpiece — do this carefully)
- [ ] Write a failing-style instrumentation first: a test or script that counts SQL queries for `applications { contacts }` over the seeded N rows (wrap the better-sqlite3 driver or use Drizzle's logger; commit the counter)
- [ ] Implement `Application.contacts` naively; record the measured N+1 count in README's metrics table
- [ ] Convert to DataLoader via `@pothos/plugin-dataloader`; record the after count (expect 2)
- [ ] Same treatment for one more relation (e.g. `Application.events` or `Contact.application` reverse lookup) to show it generalizes
- [ ] Short README "Decisions" entry: why DataLoader over join-at-the-root, with the tradeoff
- DoD: metrics table filled with measured before/after numbers and the method
  linked; unit test asserts the batched query count stays at the batched number
  (regression guard).

### M3 — Typed operations + schema snapshot
- [ ] GraphQL Codegen for client operations (typed hooks or typed documents; pick one, log the decision)
- [ ] Commit a generated `schema.graphql` snapshot; add a CI step that regenerates and fails on drift
- [ ] Migrate existing client queries/mutations to the generated types; delete hand-written operation types
- DoD: no `any` or hand-rolled operation types on the client; CI fails if
  schema and snapshot diverge.

### M4 — UI build-out + Storybook
Design note: owner is strongest in MUI, but this project intentionally shows
hand-rolled components. Keep the design minimal and consistent (CSS modules or
vanilla-extract; log the decision). No component library dependency.
- [ ] Extract the UI into components: `ApplicationsTable`, `StageBadge`, `FollowUpCell` (overdue state), `ContactList`, `AddApplicationForm`
- [ ] Storybook installed and configured for Next.js; a story per component including edge states (empty, long text, overdue follow-up, error)
- [ ] Interaction tests (play functions) for the form and the stage change at minimum; wire `@storybook/test-runner` into CI
- [ ] A11y addon enabled; fix what it flags in the stories
- DoD: `npm run storybook` works; every component above has stories + at least
  two interaction tests pass in CI.

### M5 — App Router depth: streaming SSR + RSC boundaries
- [ ] Integrate `@apollo/client-integration-nextjs`; first paint of the applications table streams from the server, mutations stay client-side
- [ ] Make the server/client component split explicit and minimal ("use client" only where interaction demands it); document the boundary in a short README section
- [ ] Loading UI via Suspense boundaries (`loading.tsx` or inline) that matches the final layout (no layout shift)
- [ ] e2e test asserts the table renders with JS disabled (initial HTML contains seeded rows)
- DoD: table content present in the server-rendered HTML, verified by the e2e
  test; decision entry on the integration approach.

### M6 — Performance + RUM (closes the "frontend performance" claim)
- [ ] Grow the seed to a stress dataset (e.g. 5,000 applications) behind a flag; virtualize the table (TanStack Virtual or hand-rolled; log the decision); measure render before/after
- [ ] Web-vitals collection: report LCP/CLS/INP from the browser to a tiny `/api/vitals` route that logs to SQLite; a simple `/vitals` page lists the collected numbers
- [ ] Bundle budget: analyze with `next build`'s output; set a budget in CI (fail if the main route's first-load JS exceeds the recorded baseline + 10%)
- [ ] Record all measured numbers (before/after virtualization, vitals on the seeded app, first-load JS) in README's metrics section
- DoD: every number measured and committed with its method; CI enforces the
  bundle budget; the stress seed renders smoothly (document the measurement).

### M7 — Accessibility pass
- [ ] axe checks in Playwright (`@axe-core/playwright`) on the main page and the form, zero serious/critical violations
- [ ] Full keyboard path e2e: add an application, change a stage, set a follow-up without a mouse
- [ ] Focus management on dialogs/forms (focus trap, return focus on close); visible focus states
- DoD: axe e2e green in CI; keyboard e2e green.

### M8 — Deploy + demo mode
- [ ] Decide hosting for a single-user SQLite app (likely: Vercel + demo mode where each cold start seeds an in-memory/ephemeral DB and the UI shows a "demo data resets" banner; alternative: libSQL/Turso). Write the decision entry BEFORE building
- [ ] Deploy; seeded demo reachable at a public URL; GraphiQL disabled or read-only in demo
- [ ] README: live demo link at top, badge `<USER>` swapped to `lakhtea`, screenshots (light on marketing, heavy on substance)
- DoD: public URL works from a clean browser; README links to it.

### M9 — Public polish (last)
- [ ] README final pass: architecture diagram still accurate, every Decisions entry present, metrics tables complete, no TBDs left
- [ ] `LICENSE` sanity check, repo description + topics suggestions for GitHub listed in the Session Log for Lakhte
- [ ] Lakhte pushes to github.com/lakhtea/pipeline (HE creates the repo and pushes; Claude Code prepares everything but never creates accounts or pushes to a remote it was not given)
- DoD: `git log` tells a coherent story; a stranger can clone, seed, run, and
  understand every claim in the README within ten minutes.

## Working agreements for long autonomous runs

- Work milestones strictly in order; within a milestone, checkboxes in order
  unless a blocker forces a swap (note the swap in the Session Log).
- If blocked (missing credential, ambiguous product call, deploy account
  needed), write the question under "Blocked / needs Lakhte" in the Session
  Log, pick the next unblocked item, and continue. Never invent credentials,
  never create external accounts.
- Prefer boring solutions. This repo demonstrates judgment, and judgment reads
  as restraint.
- Keep `npm run db:seed` idempotent forever; tests must never depend on seed
  order.
- Update this file's checkboxes in the same commit as the work they describe.

## Parked ideas (append here instead of building)

- (none yet)

## Blocked / needs Lakhte

- M8 hosting account (Vercel or similar) when M8 starts.
- M9 GitHub repo creation + push (Lakhte's account).

## Session Log

Append one short entry per session: date, items completed, measurements taken,
decisions logged, anything blocked.

- 2026-10-08 — Repo created from the verified-green scaffold (previously in
  `Job Search/pipeline`, untouched there). PLAN.md + CLAUDE.md added. Baseline
  state: walking skeleton (schema → resolver → Yoga → Apollo table) with unit +
  e2e tests and CI, per README roadmap. Next: M0.
