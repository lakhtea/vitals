# 99 - Use this repo as a template

> Draft written at M6. It will be refreshed at M11, when the skeleton is final and every list below is re-checked against the tree.

## What you are taking and what you are leaving

The skeleton is a walking slice through one stack: Next.js 16 App Router, Pothos (code-first schema) served by GraphQL Yoga, Apollo Client in the browser, Drizzle on SQLite via better-sqlite3, zod at the ingest boundary, GraphQL Codegen typed documents, Vitest (unit, in-memory SQLite), Playwright (e2e), Storybook with the Vitest addon, and one GitHub Actions workflow that runs all of it.
The domain is Vitals: four RUM tables, a beacon ingest endpoint, percentile SQL, DataLoader-batched relations, and a dashboard.
Everything the skeleton knows about the domain enters through imports from the REPLACE list, so deleting that list leaves a compiler error list, not a mystery.

### KEEP (skeleton)

- `package.json` (scripts, `engines`, `allowScripts`), `package-lock.json`, `.nvmrc`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.gitignore`.
- `vitest.config.mts`: the `@` and `graphql` aliases, the `unit` and `storybook` projects, coverage excludes.
- `playwright.config.ts`: boots a seeded app on its own database file.
- `codegen.ts`: client preset, scans `src/**`, excludes tests and `generated/`.
- `drizzle.config.ts`: points drizzle-kit at `src/db/schema.ts` and `./drizzle`.
- `.storybook/main.ts`, `preview.ts`, `vitest.setup.ts`: Next.js-on-Vite framework, a11y violations as failures, stories as Vitest tests.
- `.github/workflows/ci.yml`: lint, typecheck, unit with coverage, `codegen:check`, Storybook tests, e2e.
- `TESTING_RULES.md`: the testing policy; see "Things people forget".
- `src/app/api/graphql/route.ts`, `src/app/layout.tsx`, `src/app/providers.tsx`, `src/app/globals.css` (keep the token structure, change the values).
- `src/graphql/builder.ts`, `context.ts`, `scalars.ts` (DateTime is domain-neutral), `schema-snapshot.test.ts`.
- `src/db/index.ts` (`makeDb`, `getDb`, migrate-on-open), `src/db/query-counter.ts`.
- `src/db/synthetic/random.ts`: the seeded PRNG and distributions, useful for any deterministic seed.
- `scripts/print-schema.ts`, and the harness in `scripts/measure-query-count.ts` (its `OPERATIONS` list is domain; swap it).
- `docs/TOUR.md` and `docs/learning/GLOSSARY.md` as structures, and `docs/learning/00-the-skeleton.md`, which is still true of the plumbing.

### REPLACE (domain)

- `src/vitals/`: metric names, thresholds, ratings, device and connection dimensions.
- `src/collect/` and `src/app/api/collect/route.ts`: the zod payload, ingest transaction, HTTP handler, and its tests. Delete outright if your domain has no public write endpoint.
- `src/db/schema.ts`, `src/db/seed.ts`, `src/db/seed.test.ts`, `src/db/synthetic/traffic.ts`, `src/db/queries/` (`filter.ts`, `pages.ts`, `metrics.ts`, `sessions.ts`).
- `src/graphql/enums.ts`, `inputs.ts`, `types/`, `loaders/`, `schema.ts` (keep its last line, `builder.toSchema()`, and the `import "./scalars"`), `schema.test.ts`, `metrics.test.ts`.
- `src/graphql/generated/` and `schema.graphql`: never edited, always regenerated; they are listed here because their contents are the domain.
- `src/app/page.tsx` and `src/dashboard/` (from M6: `MetricCard`, `TimeSeriesChart`, `PagesTable`, `SessionsTable`, `FilterBar`, their CSS modules and stories).
- `e2e/home.spec.ts`, `e2e/collect.spec.ts`.
- `drizzle/`: the migration SQL and `meta/`; regenerate, do not edit (see below).
- `lib/vitals-client/`: the browser library is its own package and leaves with the domain.
- `README.md` body, `docs/learning/01-*` onward, the `title` in `layout.tsx` `metadata`, and the package `name`.

## The order to replace things in

Work bottom-up, from the table definitions to the page, because every layer's types are derived from the one below it.
At each step, the red tests tell you what the next step is.
Before step 1, confirm the baseline is green on a clean clone: `npm ci && npm run typecheck && npm run lint && npm run test && npm run test:e2e`.

1. **Vocabulary and tables.**
   Replace `src/vitals/` with your domain's enums and constants (or delete it), then rewrite `src/db/schema.ts`.
   Run `rm -rf drizzle .data && npm run db:generate`.
   Green: drizzle-kit writes `drizzle/0000_<name>.sql` and a fresh `meta/`.
   Red: `npm run typecheck` fails in every file that imports the old tables; that error list is your worklist for steps 2 to 4.
2. **Seed.**
   Rewrite `src/db/synthetic/traffic.ts` (or a simpler generator) and `src/db/seed.ts`, keeping deterministic ids and `onConflictDoNothing()`.
   Rewrite `src/db/seed.test.ts` to assert counts and that a second run changes nothing.
   Run `npm run db:seed` twice, then `npx vitest run src/db/seed.test.ts`.
   Green: the second seed reports nothing inserted; the seed test passes.
   Red: everything under `src/graphql` and `src/collect`, which still name the old rows.
3. **Queries.**
   Rewrite `src/db/queries/` as plain functions taking `{ db, ... }` and returning row types, with no GraphQL imports.
   Run `npx vitest run src/db`.
   Green: all database tests.
   Red: the GraphQL tests, because the resolvers still call deleted query functions.
4. **Pothos types.**
   Rewrite `enums.ts`, `inputs.ts`, `types/`, `loaders/`, and `schema.ts`; keep `builder.ts`, `context.ts`, `scalars.ts` untouched.
   Rewrite or delete `src/collect/` at the same time, since it shares the row types.
   Run `npm run typecheck && npx vitest run src/graphql src/collect`.
   Green: typecheck, `schema.test.ts`, and the collect tests if kept.
   Red: `schema-snapshot.test.ts`, because `schema.graphql` still describes Vitals; that failure is the signal for step 5.
5. **Codegen.**
   Run `npm run codegen`, which rewrites `schema.graphql` and `src/graphql/generated/`.
   Green: `npm run test` in full, the snapshot test included.
   Red: `npm run typecheck` in `src/app/page.tsx`, because the generated `graphql()` no longer has an overload for the old query string; that is the signal for step 6.
6. **Page and components.**
   Rewrite `src/app/page.tsx` and `src/dashboard/` against the new schema, writing each query through `graphql()`.
   Run `npm run codegen && npm run typecheck && npm run lint && npm run dev`, then open `http://localhost:3000` and GraphiQL at `/api/graphql`.
   Green: typecheck, lint, seeded data on the page, your schema in GraphiQL's docs panel.
   Red: `npm run test:e2e` (asserts the old cells) and `npm run test:storybook` (stories for deleted components); the signal for step 7.
7. **Tests and the measurement harness.**
   Rewrite `e2e/*.spec.ts`, the stories and play functions, and the `OPERATIONS` list in `scripts/measure-query-count.ts`.
   Run `npm run test:e2e && npm run test:storybook && npm run measure:queries && npm run codegen:check`.
   Green: all four, and `codegen:check` exits 0 with nothing to regenerate.
8. **Docs.**
   Rewrite the README body, `docs/TOUR.md`, the glossary, and chapter 01 for the new domain; keep chapter 00.
   Run `git grep -il -E "vitals|pageview|metric_events|LCP"` and clear every hit that is not git history or this chapter.
   Green: the grep is empty, `git status` is clean after `npm run codegen`, and a stranger can run the "Run it" section of the TOUR.

## Things people forget

- **Regenerate `drizzle/` from scratch.**
  drizzle-kit diffs against `drizzle/meta/0000_snapshot.json`, so editing `schema.ts` and running `db:generate` on top of the Vitals snapshot produces a `0001` migration full of `DROP TABLE` and `ALTER`, and every fresh database replays the Vitals DDL first.
  Delete the whole folder, including `meta/_journal.json`, before the first generate.
  Delete `.data/` too, or a local database keeps the old `__drizzle_migrations` ledger.
- **`allowScripts` in `package.json`.**
  npm 11 refuses install scripts by default; better-sqlite3 needs its native build step.
  Without the block, `npm ci` succeeds and the first `makeDb` call throws.
  Node 24 has no prebuilt binary and compiles from source; CI pins Node 22 through `.nvmrc` and `setup-node`.
- **The `graphql` alias in `vitest.config.mts`.**
  Some dependencies load graphql-js as CommonJS while Vite loads the ESM build; two copies produce "Cannot use GraphQLSchema from another module or realm" the first time a test executes a query.
  The alias forces one resolved path.
  Keep the `@` alias beside it, or `@/` imports resolve in the app and not in tests.
- **`defaultFieldNullability: false` in `builder.ts`.**
  It is set twice, as a type parameter and as a builder option, and both are needed.
  Without it, Pothos v4 makes every field nullable, the client types fill with null checks, and nobody notices until codegen (chapter 05 has the story).
- **Regenerate and commit `schema.graphql` and `src/graphql/generated/`.**
  `codegen:check` in CI regenerates both and runs `git diff --exit-code`.
  `generated/` is lint-ignored in `eslint.config.mjs` and coverage-excluded in `vitest.config.mts`; keep both exclusions when you rename anything.
  The schema must be regenerated before the client types, which is why the `codegen` script runs `print-schema.ts` first.
- **Rename `VITALS_DB_PATH`.**
  It appears in `src/db/index.ts` (`resolveDbPath` and `DEFAULT_DB_PATH`), `drizzle.config.ts`, `playwright.config.ts`, the TOUR's environment table, and the README.
  `git grep VITALS_DB_PATH` finds them all.
- **Update the Playwright `webServer`.**
  Its `command` deletes the e2e database and its WAL sidecars, seeds, then starts dev; its `env` passes the database path.
  If the seed script, the variable, or the file name changes, both lines change.
- **`src/db/index.ts` runs `migrate()` on every open, including `:memory:`.**
  Tests exercise the committed DDL for free; do not reintroduce inline `CREATE TABLE`.
  `MIGRATIONS_FOLDER` resolves from `process.cwd()`, so scripts run from the repo root.
- **`.storybook/main.ts` globs `src/**/*.stories.tsx`.**
  Put stories next to components or change the glob; `preview.ts` imports `globals.css`, so the token file must keep existing.
- **`TESTING_RULES.md` is the testing policy; keep it.**
  It is why the suite is small and every test names a failure it prevents.
  Apply it from step 2 onward instead of porting the Vitals tests one for one.

## What to keep from the teaching layer

Keep the shape of the documentation even if you write far less of it.

- `docs/TOUR.md`: a one-line current state, the one-paragraph version, the directory map, one "follow a request" trace per path through the system, the data model in one breath, the test table, the "when you change the schema" recipe, "run it", the chapter list, and the environment-variable table.
  It is the file a stranger reads first and the one most likely to go stale, so update it in the same commit as the code.
- `docs/learning/GLOSSARY.md`: grouped by area, two or three sentences per term, added the first time a term appears, linked from chapters instead of re-explained.
- The chapter template, in this order: what was built; the concept from first principles, not just this repo's usage; why every new file exists (problem it solves, why it lives there, what breaks without it); how to see it working, with exact commands; three to five self-check questions with answers under a `<details>` block.
  Chapter 04's "interview answers, in your words first" and "exercise" sections are worth copying for any showpiece milestone.
- The one-to-three-line "why this exists" header at the top of every source file.
- The README "Decisions" format: problem, options, choice, tradeoff, one paragraph.
  Every non-obvious choice gets one, and every number in the README is measured by a committed script.
