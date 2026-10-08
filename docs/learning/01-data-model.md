# 01 - The data model

> Milestone 1 replaced the placeholder job-tracker domain with the RUM domain.
> Nothing tracker-shaped survives outside git history.
> This chapter explains the four tables, how Drizzle maps them, what a migration is, and how the seed fakes realistic traffic.

## What was built

- Four Drizzle tables: `sites`, `sessions`, `pageviews`, `metric_events`.
- Real migrations: drizzle-kit now generates versioned SQL into `drizzle/`, and the app applies pending migrations when it opens the database.
- A deterministic, idempotent synthetic seed: 50 sessions over 10 paths with believable timing distributions.
- GraphQL types `Site` and `Page`, with root queries `sites`, `site(id)`, and `pages(siteId)`.
- The dashboard home now lists every measured path with its pageview and event counts.
- The domain vocabulary (metric names, ratings, thresholds, device classes, connection types) lives in `src/vitals/`, where both the database and, from M2, the ingest validator import it.

## Why four tables and not fewer

The tempting shortcut is one flat `metric_events` table with the path, device, and connection copied onto every row.
It fails on the first real question the dashboard has to answer.

The dashboard asks at three grains.
"How many sessions came from mobile" needs a session to be a row, not a value repeated across its events.
"Which pages are slow" groups by pageview, not by event, because one pageview emits up to five events and must count once.
"Show me what this one visitor experienced" needs the pageviews of a session in order.
Each grain gets a table, and each table owns exactly the facts that are true at that grain:

- `sites`: who is being measured.
  There is one in v1, but the browser library sends a `siteId` from day one, and scoping every query by site now is far cheaper than retrofitting it.
  The dashboard measuring itself (M8) becomes a second site.
- `sessions`: one visitor's visit.
  Owns the "for whom" facts: device class, connection type, browser family, and when it started.
- `pageviews`: one navigation within a session.
  Owns the path and the start time.
- `metric_events`: one reported value of one metric for one pageview.
  Owns name, value, rating, and the dedupe key.

More tables were considered and rejected: lookup tables for browsers or devices add joins without adding questions we can answer, and v1 is a kit, not a warehouse.

## The keys, and why the browser chooses them

`sessions.id` and `pageviews.id` are text and generated in the browser.
The library (M3) will mint a session id when it starts and a pageview id on every navigation.
That is what makes delivery safe to retry: if a batch is sent twice, both copies name the same pageview, so the server can recognise the duplicate.
A server-assigned auto-increment id cannot do that, because the second copy would simply get a new number.

`metric_events` has an auto-increment primary key for convenience, but its real identity is the unique index on `(pageview_id, name, metric_id)`.
`metric_id` is the `id` the `web-vitals` package attaches to each metric instance (see the `Metric` type in `node_modules/web-vitals/dist/modules/types/base.d.ts`), which exists precisely so analytics backends can dedupe.
M2's ingest endpoint relies on this index: inserting a duplicate becomes a no-op instead of a double count.

`sites.id` is a slug ("demo"), not a secret.
It identifies, it does not authenticate; multi-tenant auth is explicitly out of scope.

## Timestamps and enums

Every `*_at` column is an integer: milliseconds since the Unix epoch, UTC.
SQLite has no date type, integers compare and index faster than ISO strings, and the browser's `Date.now()` already produces this unit, so nothing is parsed or formatted on the hot path.
GraphQL exposes ISO 8601 strings (`Site.createdAt`) because humans and Apollo both prefer them.

Columns like `device_class` and `rating` are plain text with a Drizzle `enum` option.
That gives TypeScript a string-union type for the column with no runtime cost.
The database does not enforce the set; the ingest boundary (zod, M2) does, which is where untrusted data enters.
Adding SQLite `CHECK` constraints would be a reasonable belt-and-braces step and was skipped to keep the migration readable.

## Indexes and foreign keys

- `sessions (site_id, started_at)`: every dashboard query is scoped to a site and most will be bounded by time.
- `pageviews (session_id)`: the session detail view and the M4 `Session.pageviews` loader.
- `pageviews (path)`: grouping by page.
- `metric_events (pageview_id, name, metric_id)` unique: the dedupe key described above.
- `metric_events (name, recorded_at)`: per-metric time-range aggregates in M4.

SQLite ignores `FOREIGN KEY` clauses unless each connection runs `PRAGMA foreign_keys = ON`.
`makeDb` does, so inserting a pageview for a session that does not exist fails loudly instead of leaving an orphan.

## How Drizzle maps the tables

`src/db/schema.ts` is the single definition.
From it Drizzle derives three things:

1. The SQL, through drizzle-kit (next section).
2. The row types: `typeof sessions.$inferSelect` is what a `SELECT` returns and `$inferInsert` is what `INSERT` accepts, with defaults and auto-increment columns optional.
3. The query builder's knowledge of column names and types, so `eq(pageviews.sessionId, sessions.id)` is checked at compile time.

The page aggregate in `src/db/queries/pages.ts` is a good one to read.
It joins pageviews to sessions (to filter by site) and left-joins metric events (so a pageview with no events still counts), then groups by path.
Because the left join repeats each pageview once per event, pageviews are counted with `COUNT(DISTINCT pageviews.id)`.
In SQL it is roughly:

```sql
SELECT sessions.site_id, pageviews.path,
       COUNT(DISTINCT pageviews.id) AS pageview_count,
       COUNT(metric_events.id)      AS event_count
FROM pageviews
JOIN sessions      ON pageviews.session_id = sessions.id
LEFT JOIN metric_events ON metric_events.pageview_id = pageviews.id
WHERE sessions.site_id = ?
GROUP BY sessions.site_id, pageviews.path
ORDER BY pageview_count DESC, pageviews.path;
```

## What a migration is

A migration is a versioned, ordered script that moves a database from one schema to the next.
The skeleton created tables with inline `CREATE TABLE IF NOT EXISTS`, which works exactly until the second version of a table: `IF NOT EXISTS` never alters an existing table, so adding a column silently does nothing on every database created before the change.

The flow now:

1. Edit `src/db/schema.ts`.
2. Run `npm run db:generate`.
   drizzle-kit compares the schema to the last snapshot in `drizzle/meta/` and writes the difference as `drizzle/NNNN_<name>.sql` plus a new snapshot.
3. Commit the SQL and the snapshot with the code change.
4. At runtime `makeDb` calls `migrate()`, which keeps a `__drizzle_migrations` table, applies any file it has not yet applied, in order, and records it.

Two rules follow.
Never edit a migration that has been committed; add a new one.
And run `migrate()` on every database you open, including `:memory:` in tests, so tests always exercise the same DDL as production.

## How the seed fakes realistic traffic

`src/db/synthetic/traffic.ts` is pure: it returns arrays of rows and touches no database, so you can read it top to bottom as a description of the fake world.

**Deterministic randomness.**
`createRng(seed)` is mulberry32, a small 32-bit generator.
Given the same seed number it returns the same sequence forever, so the demo data is identical on every machine, screenshots match the docs, and the e2e test can assert on specific paths.

**Right-skewed timings.**
Real page timings are not bell-shaped; most loads cluster and a long tail is slow.
A log-normal distribution has exactly that shape, so TTFB, FCP, LCP, and INP are each sampled with `logNormal({ median, sigma })`.
The sampled durations are added in order (`FCP = TTFB + …`, `LCP = FCP + …`), which guarantees the physical ordering TTFB < FCP < LCP that real browsers report.

**Personalities.**
Each path has multipliers: the image-heavy blog post has worse LCP and CLS, the JavaScript-heavy dashboard has worse INP, the login page is light.
Each device class and connection type multiplies timings too, with mobile on 3G landing where you would expect.

**The CLS mixture.**
Seventy percent of pageviews land near zero, twenty percent in the needs-improvement band, ten percent are outliers.
That is what real CLS looks like: mostly fine, occasionally terrible.

**INP only when someone interacted.**
About seventy percent of pageviews get an INP event; the rest never had a qualifying interaction, which is true of real traffic and matters for M4's per-metric sample counts.

**Browser realism.**
Safari and Firefox do not expose `navigator.connection`, so sessions from those browsers get `connectionType: "unknown"`.
The dashboard will show that bucket honestly rather than inventing a value.

**Idempotency.**
Every seeded row has a deterministic id (`seed-s12-p3-LCP`).
Inserts use `ON CONFLICT DO NOTHING`.
Run the seed twice and the second run inserts nothing; run it on a database that already holds real ingested traffic and both coexist.
This beats the old "skip if the table is not empty" check, which could never top up a partially seeded database and could never share a database with real data.
One caveat: timestamps are relative to the first run, so seeded traffic ages.
The Playwright config deletes its database before seeding for that reason.

## Why every new file exists

- `src/vitals/metrics.ts`: metric names, ratings, thresholds (imported from `web-vitals`, never hand-copied), and `rateMetric`.
  Both the seed and, from M2, the ingest validator depend on it.
- `src/vitals/dimensions.ts`: device classes and connection types, with an explicit `unknown` because browsers genuinely do not always know.
- `src/db/schema.ts`: the four tables.
- `src/db/index.ts`: opens the database, enables WAL and foreign keys, runs migrations, exposes `makeDb` for tests and a lazy `getDb` for the app.
  Lazy, because the old module opened a file as a side effect of being imported, which meant importing it in a test created a database on disk.
- `src/db/queries/pages.ts`: the per-path aggregate, kept outside the resolver so the SQL can be tested and reused.
- `src/db/synthetic/random.ts`: the PRNG and the distribution helpers.
- `src/db/synthetic/traffic.ts`: the pure traffic generator described above.
- `src/db/seed.ts`: wires the generator to the database inside one transaction, with conflict-ignoring inserts.
- `drizzle/0000_rum_domain.sql` and `drizzle/meta/*`: the generated migration and the snapshot drizzle-kit diffs against next time.
- `drizzle.config.ts`: tells drizzle-kit where the schema and the output folder are.
- `src/graphql/schema.ts`: `Site`, `Page`, and the root queries.
  `Page` has no `id` because it is an aggregate, not a stored row; Apollo therefore caches it nested inside its `Site` rather than as a top-level record.
- Tests: `src/vitals/metrics.test.ts` (threshold edges are inclusive), `src/db/seed.test.ts` (idempotency, and stored ratings agree with the thresholds), `src/graphql/schema.test.ts` (page counts add up to the stored rows; root `pages` ordering), `e2e/home.spec.ts` (seeded paths reach the browser).
  Each protects a behaviour that would silently produce wrong numbers if it regressed, which is the bar TESTING_RULES.md sets.

## How to see it working

```bash
npm run db:seed              # creates .data/vitals.db, applies the migration, inserts traffic
npm run db:seed              # again: "rows that already existed were left untouched"
npm run dev                  # http://localhost:3000 shows the pages table
```

In GraphiQL at `http://localhost:3000/api/graphql`:

```graphql
{
  sites {
    id
    name
    pages { path pageviewCount eventCount }
  }
}
```

Look at the raw data with the sqlite3 CLI (ships with macOS):

```bash
sqlite3 .data/vitals.db "select name, count(*), round(avg(value),1) from metric_events group by name;"
sqlite3 .data/vitals.db "select device_class, connection_type, count(*) from sessions group by 1,2 order by 3 desc;"
sqlite3 .data/vitals.db "select * from __drizzle_migrations;"
```

## Self-check

1. Why do `sessions` and `pageviews` have text ids chosen by the browser while `metric_events` has an auto-increment id?
2. A pageview has no metric events yet. Does it appear in `Site.pages`, and with what `eventCount`? Which SQL keyword makes that true?
3. You add a `country` column to `sessions`. List the exact steps until it exists in production.
4. Why does the seed sample `LCP` as `FCP + logNormal(...)` instead of sampling it independently?
5. The seed is run on a database that already contains real traffic from the browser library. What happens?

<details>
<summary>Answers</summary>

1. Sessions and pageviews must have stable identities across retried deliveries, which only the sender can provide. Metric events are deduplicated by the unique index on (pageview, name, metric id), so their primary key can be a convenience.
2. Yes, with `eventCount: 0`, because the query uses `LEFT JOIN` on metric events rather than an inner join.
3. Edit `src/db/schema.ts`; run `npm run db:generate`, which writes `drizzle/0001_*.sql` and a new snapshot; commit both with the code; on the next start `makeDb` runs `migrate()`, which applies the new file and records it in `__drizzle_migrations`.
4. Because a real browser cannot paint the largest element before it paints anything; adding durations preserves TTFB < FCP < LCP, which independent samples would violate.
5. Nothing is overwritten. Seeded rows have deterministic ids and inserts use `ON CONFLICT DO NOTHING`, so only missing seed rows are added and the real rows are untouched.

</details>
