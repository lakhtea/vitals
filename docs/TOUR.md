# The ten-minute tour

> Updated every milestone.
> Read top to bottom and you will know where everything lives and why.
> For the deep version of any section, follow the link to its learning chapter.

Current state: **M0 complete.**
The walking skeleton is verified green and documented.
The domain code is still the placeholder job tracker; M1 replaces it.

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
│   │   └── page.tsx          the one page (placeholder table until M1)
│   ├── graphql/              Pothos builder, context, schema, schema tests
│   └── db/                   Drizzle schema, connection, seed
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

Browser `page.tsx` -> Apollo `useQuery` -> `POST /api/graphql` -> `route.ts` -> Yoga -> Pothos resolvers in `schema.ts` -> Drizzle -> better-sqlite3 -> `.data/*.db`.
Chapter 00 walks this path step by step.

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
- [Glossary](learning/GLOSSARY.md): every term of art, two or three sentences each.

## What is placeholder

Everything under `src/` that mentions applications, contacts, or stages.
M1 deletes it.
