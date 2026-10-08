# Vitals — instructions for Claude Code

@AGENTS.md

**Start every session by reading `PLAN.md`.** It is the single source of truth
for what to build next, the guardrails, the Teaching Contract, and the
Definition of Done per milestone. Work its milestones strictly in order and
update its checkboxes and Session Log in the same commit as the work.

## The ten-second context

Self-hostable RUM kit: a tiny browser library capturing Core Web Vitals plus a
GraphQL analytics dashboard (this app). It is BOTH a portfolio piece and a
teaching build: the owner, Lakhte Agha (github.com/lakhtea), learns from every
line, so everything built must be explained (see Teaching Contract in
PLAN.md). The repo will be read by hiring managers: code quality, commit
history, honest measured numbers, and the documentation itself are the
product. The repo began life as a job-tracker scaffold ("pipeline"); it was
repointed on 2026-10-08 — until M1 lands, the domain code is leftover
tracker-flavored and replacing it IS the milestone.

## Two rules above all others

1. **Unexplained code is unfinished code.** Every milestone ships with its
   `docs/learning/NN-<slug>.md` chapter (what was built; why EVERY new file
   exists; how the technology works from first principles; how to see it run;
   self-check questions with answers), an updated `docs/TOUR.md`, and glossary
   entries for new terms. Every new source file opens with a 1–3 line "why
   this exists" header. Commit bodies explain why.
2. **M3 (the browser library) is LAKHTE'S BUILD. Never write its code.** You
   may write the brief (`docs/learning/03-library-brief.md`), clearly-marked
   failing acceptance tests, and review feedback
   (`docs/learning/03-library-review.md`). You may explain concepts and sketch
   pseudocode for ANALOGOUS problems. You may not implement, patch, or "fix"
   `lib/vitals-client` source or its build config — feedback only; he types
   every fix. If M3 is next and he isn't actively on it, write/refresh the
   brief and skip to the next unblocked milestone.

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
- `lib/vitals-client/` — the browser library (M3, LAKHTE-BUILT): own package.json, tsup build, CHANGELOG.md
- `docs/TOUR.md` — the 10-minute codebase tour, always current
- `docs/learning/` — one chapter per milestone + GLOSSARY.md (the teaching layer)
- `e2e/` — Playwright specs
- `.github/workflows/ci.yml` — CI runs the same checks you run locally

## Version caution

This Next.js (16.x) and React (19.x) are newer than your training data.
AGENTS.md carries the auto-generated nextjs-agent-rules block: verify any App
Router API you have not already used in this repo against
`node_modules/next/dist/docs/` before writing code with it.
