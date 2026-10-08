# Vitals — instructions for Claude Code

@AGENTS.md

**Start every session by reading `PLAN.md`.** It is the single source of truth
for what to build next, the guardrails, and the Definition of Done per
milestone. Work its milestones strictly in order and update its checkboxes and
Session Log in the same commit as the work.

## The ten-second context

Self-hostable RUM kit: a tiny browser library capturing Core Web Vitals plus a
GraphQL analytics dashboard (this app), built as public evidence of specific
skills (GraphQL/DataLoader, Next.js App Router, Storybook, performance with
measured numbers, library release engineering, a11y). The owner is Lakhte Agha
(github.com/lakhtea). The repo will be read by hiring managers: code quality,
commit history, and honest measured numbers in the README are part of the
product. The repo began life as a job-tracker scaffold ("pipeline"); it was
repointed on 2026-10-08 — until M1 lands, the domain code is leftover
tracker-flavored and replacing it IS the milestone.

## Commands

```bash
npm run dev          # http://localhost:3000 · GraphiQL at /api/graphql
npm run db:seed      # idempotent synthetic traffic (tracker-flavored until M1)
npm run test         # Vitest unit tests (in-memory SQLite)
npm run test:e2e     # Playwright
npm run typecheck && npm run lint
```

## Non-negotiables (full list in PLAN.md "Hard guardrails")

- Green tree before every commit: typecheck + lint + test.
- Tests land in the same commit as the feature they cover.
- Every number in README.md is measured in this repo, with the method
  committed. TBD is acceptable; a guess is not.
- Vitals semantics follow web.dev: p75 headline aggregate, per-metric
  thresholds, INP not FID. Check the `web-vitals` docs in node_modules before
  guessing a definition.
- No scope creep: no error tracking, no session replay, no alerting, no
  multi-tenant auth, no AI features. Park ideas in PLAN.md instead.
- Conventional commits, small and self-contained.
- Non-obvious choices get a README "Decisions" entry:
  problem → options → choice → tradeoff.
- Never create external accounts, never push to a remote Lakhte has not set
  up, never invent credentials. Blocked items go in PLAN.md's
  "Blocked / needs Lakhte" and you move on.

## Layout

- `src/app/` — Next.js App Router; GraphQL endpoint at `src/app/api/graphql/route.ts`; collect endpoint at `src/app/api/collect/route.ts` (from M2)
- `src/graphql/` — Pothos builder, schema, context (+ schema tests)
- `src/db/` — Drizzle schema, connection, idempotent seed
- `lib/vitals-client/` — the browser library (from M3): own package.json, tsup build, CHANGELOG.md
- `e2e/` — Playwright specs
- `.github/workflows/ci.yml` — CI runs the same checks you run locally

## Version caution

This Next.js (16.x) and React (19.x) are newer than your training data.
AGENTS.md carries the auto-generated nextjs-agent-rules block: verify any App
Router API you have not already used in this repo against
`node_modules/next/dist/docs/` before writing code with it.
