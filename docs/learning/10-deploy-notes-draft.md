# M10 deploy notes (draft, to be folded into README, NEEDS-LAKHTE, and chapter 10)

Written 2026-10-07 alongside the demo-mode code.
Nothing here has been deployed; every Vercel step below is for Lakhte to run.

## README "Decisions" entry (paste as-is)

### Hosting: Vercel with an ephemeral, seeded SQLite per cold start
The dashboard is single-tenant and its database is one SQLite file, which no
serverless host keeps between invocations. Options: a host with a disk (a
Fly.io volume, a VPS), which persists data but adds a machine to run, patch,
and pay for; libSQL/Turso, which keeps the SQL but swaps the embedded
synchronous driver for a network one, so every `.get()`/`.run()` in the query
layer becomes an `await` and the demo depends on a second vendor; or Vercel
with a "demo mode" that opens the database in the function's temp dir,
migrates and seeds it on first open, and accepts that it vanishes with the
instance. Choice: Vercel plus demo mode behind one env var,
`VITALS_DEMO_MODE=1`, which also hides GraphiQL and rate-caps `/api/collect`
(120 batches per minute per site, in memory). Self-hosters are untouched: the
switch only changes where the file lives and whether it is seeded. Tradeoff:
the public demo forgets everything on a cold start, and concurrent warm
instances each hold their own copy, so a beacon sent to one instance may not
appear in a dashboard served by another; the self-measurement panel therefore
demonstrates the loop, not durable history. Real multi-user hosting would move
to persistent SQLite (a volume or libSQL) and add an origin allow-list; the
schema and resolvers would not change.

## What demo mode does (for chapter 10)

`src/config/demo-mode.ts` is the single switch: `isDemoMode()` is true only when `VITALS_DEMO_MODE` is exactly `"1"`.
Four places read it:

- `src/db/index.ts`: when `VITALS_DB_PATH` is unset, the file defaults to `<os tmpdir>/vitals-demo.db` instead of `.data/vitals.db`, and `getDb()` runs the idempotent `seed()` right after migrating on first open.
  The seed CLI moved to `scripts/seed-db.ts` so `seed.ts` no longer imports `getDb`, which is what lets `index.ts` import `seed` without an import cycle.
- `src/app/api/collect/route.ts`: a fixed-window limiter (`src/collect/rate-limit.ts`, `DEMO_COLLECT_RATE_LIMIT`) keyed by the body's `siteId` answers `429 { error: { code: "rate_limited" } }` with `retry-after` and the usual CORS headers.
  `src/collect/handle.ts` is untouched, so its tests still describe the whole ingest contract.
- `src/app/api/graphql/route.ts`: `graphiql: !isDemoMode()`; POST (and GET with `?query=`) keep working.
- `src/app/DemoBanner.tsx`: a server component that renders the one-line `role="status"` banner only in demo mode.
  It still has to be mounted in `src/app/layout.tsx`.

`next.config.ts` sets `outputFileTracingIncludes: { "/*": ["drizzle/**/*"] }`.
`migrate()` finds the migrations through `fs` at runtime (`resolve(process.cwd(), "drizzle")`), and `@vercel/nft` only traces static imports, so without this line the deployed function has no `drizzle/` folder and the first query fails on an empty database.
The option is top-level in Next 16 (verified in `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`); keys are route globs matched with picomatch in `contains` mode, so `"/*"` reaches `/api/collect` and `/api/graphql`.
`better-sqlite3` is already on Next's default `serverExternalPackages` list, so its native binding is required at runtime rather than bundled, and nft follows the `bindings` lookup to ship the `.node` file.

## Vercel setup steps (for NEEDS-LAKHTE)

1. Create the Vercel account and project.
   The Git integration needs `github.com/lakhtea/vitals` to exist (M11), so either do M11's push first or deploy from the laptop with `npx vercel` after `npx vercel login`.
2. Framework preset: Next.js.
   Build command: `npm run build` (the default `next build`).
   Install command: default (`npm ci`).
   Output directory: default.
   Root directory: repository root.
3. Node.js version: 22.
   Set it under Project Settings > General > Node.js Version.
   `package.json` already declares `"engines": { "node": ">=22" }`, which Vercel also honours.
   Node 22's npm (10.x) has no install-scripts gate; if the install log ever reports `better-sqlite3` as blocked, the committed `allowScripts` entry is the fix and nothing else is needed.
4. Environment variables (Project Settings > Environment Variables), for Production and, if previews should be demos too, Preview:
   - `VITALS_DEMO_MODE` = `1`.
     Needed at build time as well as runtime because the banner is rendered on the server during `next build`; Vercel applies project env vars to both by default.
   - `VITALS_DB_PATH`: leave unset.
     Setting it would override the temp-dir default, and only `/tmp` is writable in a Vercel function.
5. Deploy, then verify from a clean browser:
   - `/` shows the banner and seeded sites.
   - `GET /api/graphql` does not serve GraphiQL; the dashboard's queries (POST) work.
   - `POST /api/collect` with a valid batch returns 202; the 121st batch for the same `siteId` inside one minute returns 429 with `retry-after`.
   - The function log shows a `seed: 50 sessions, ...` line on each cold start.

## What resets, and when

- The SQLite file lives in the function instance's `/tmp`.
  A new instance starts empty, migrates, and seeds, so the data resets on every deploy, whenever Vercel recycles an idle instance (minutes of inactivity), and whenever it scales out, since each new instance seeds its own copy.
- Beacons accepted by `/api/collect` live only in the instance that accepted them.
  With one warm instance the self-measurement loop works end to end; with several, a dashboard request may hit an instance that has not seen that beacon.
- The rate limiter is in-memory and per instance.
  120 batches per minute per site is per instance, which is still a hard cap on what any single instance will write.
- GraphiQL stays off for the lifetime of the deployment; flipping `VITALS_DEMO_MODE` requires a redeploy because the value is read at build time for the banner and at module load for the Yoga instance.

## Local dress rehearsal (no account needed)

```bash
VITALS_DEMO_MODE=1 npm run build
VITALS_DEMO_MODE=1 npm run start
# then: open http://localhost:3000, GET /api/graphql, POST /api/collect x121
grep -c drizzle .next/server/app/api/graphql/route.js.nft.json   # should be > 0
```

The database lands in `$TMPDIR/vitals-demo.db`; delete it (and its `-wal`/`-shm` sidecars) to simulate a cold start.

## Loose ends for the fold-in

- Mount `<DemoBanner />` in `src/app/layout.tsx` (above `{children}`).
- `docs/TOUR.md`: add `scripts/seed-db.ts`, `src/config/demo-mode.ts`, `src/collect/rate-limit.ts`, and a `VITALS_DEMO_MODE` row to the env var table.
- Glossary candidates: cold start, serverless function instance, output file tracing, fixed-window rate limit.
- README "Collecting data" section: mention the demo-mode 429 and `retry-after`.
