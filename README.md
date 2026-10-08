# Pipeline

<!-- After first push: swap <USER> for your GitHub handle -->
![CI](https://github.com/<USER>/pipeline/actions/workflows/ci.yml/badge.svg)

A job-search tracker I built — and use daily — while running my own search.
GraphQL end-to-end: code-first schema with Pothos, served by GraphQL Yoga inside
Next.js, consumed through Apollo Client's normalized cache, persisted with
Drizzle + SQLite.

**Live demo:** _(coming — seeded demo mode for interviewers)_

## Why this exists

Spreadsheets lose the thread on follow-ups, and every off-the-shelf tracker is
either bloated or unowned. Building my own meant real daily usage (real edge
cases), and a deliberate tour through the full GraphQL arc: schema design,
resolvers, the N+1 problem and DataLoader, and client-side cache normalization.

## Architecture

```
SQLite ── Drizzle ORM ── Pothos (code-first schema) ── GraphQL Yoga
                                                          │  /api/graphql
Next.js (App Router) ─────────── Apollo Client (normalized cache) ── UI
```

## Decisions

_Each decision gets a short write-up as it's made; the format is
problem → options → choice → tradeoff._

### GraphQL Yoga over Apollo Server
Apollo Server still leads raw downloads (~2M/wk vs ~800K/wk in 2026) but is
increasingly oriented toward its managed/federation ecosystem; Yoga is
framework-agnostic, lighter, and the common recommendation for new projects.
The transferable skills — schema design, resolvers, DataLoader — are identical
(same graphql-js core), and Apollo expertise still shows up here where Apollo
actually dominates: the client. Tradeoff accepted: fewer JD keyword matches on
the server layer, deliberately offset by Apollo Client on the front.

### Pothos (code-first) over SDL-first
Full TypeScript inference from resolver to schema with zero codegen for the
server layer. Tradeoff: SDL-first reads more portably in reviews; mitigated by
committing a generated `schema.graphql` snapshot _(TODO)_.

### SQLite + Drizzle
Single-user tool → zero-ops local file DB, trivially seedable for demo mode and
`:memory:` tests. Tradeoff: no Postgres story in v1; revisit only if hosting
demands it.

## Metrics

_(placeholder — filled in during the DataLoader session)_

| Scenario | Queries before | Queries after DataLoader |
| -------- | -------------- | ------------------------ |
| `applications { contacts }` × N rows | TBD (N+1) | TBD |

## Development

```bash
npm install
npm run db:seed   # demo data (idempotent)
npm run dev       # http://localhost:3000 · GraphiQL at /api/graphql

npm run test      # unit tests (Vitest, in-memory SQLite)
npm run test:e2e  # Playwright, one real end-to-end path
npm run typecheck && npm run lint
```

## Scope (v1 guardrails)

Applications, stages, contacts, follow-up dates. **Deliberately excluded:**
auth-provider integrations, email scraping, AI features. Ship small, polished,
instrumented (Vitals RUM lands here once built).

## Roadmap

- [x] Walking skeleton: schema → resolver → Yoga route → Apollo Client table, tested end-to-end
- [ ] Mutations: update stage, set follow-up, add contact (one per session, each unit-tested)
- [ ] `Application.contacts` — naive N+1 first, then DataLoader; record query counts above
- [ ] GraphQL Codegen for typed client operations
- [ ] Streaming SSR via `@apollo/client-integration-nextjs`
- [ ] Deploy + seeded demo mode; a11y pass; instrument with Vitals
