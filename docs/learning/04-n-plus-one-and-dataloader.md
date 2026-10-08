# 04 - N+1 and DataLoader

> Milestone 4 built the analytics API (percentiles, rating buckets, time ranges) and used it to demonstrate the most-asked GraphQL interview question with measured numbers.
> This chapter doubles as your interview preparation.
> Read it until you can draw the diagram in "When exactly the batch fires" from memory.

## What was built

- `MetricSummary`: p50, p75, p90, the p75's rating, sample count, and good/needs-improvement/poor buckets, for one metric.
- `Page.metrics(from, to)` and `Site.metrics(from, to)`, over a half-open `[from, to)` range of `DateTime` arguments.
- `Site.sessions(limit)`, `Session`, `Pageview`, and `Session.pageviews`.
- A `DateTime` scalar and enums for `MetricName`, `MetricRating`, `DeviceClass`, `ConnectionType`.
- A query counter and a measurement script, used to record this:

| Operation | Naive | DataLoader |
| --------- | ----- | ---------- |
| `site { pages { metrics } }`, 10 pages | 12 statements | 3 statements |
| `site { sessions(limit: 20) { pageviews } }` | (built batched) | 3 statements |

Both numbers are pinned by tests, so a future change that reintroduces the N+1 fails CI.

## The N+1 problem from first principles

GraphQL execution is a tree walk.
For each field in the document, the engine calls that field's resolver with the parent's value.
When a field returns a list, the engine calls the child fields' resolvers once per item.

That rule is the whole problem.
`Site.pages` returns ten `Page` objects.
`Page.metrics` is a field on each of them, so its resolver runs ten times.
If that resolver queries the database, you get ten queries, plus the one that fetched the pages: N+1.

Here is the naive log for `{ site(id: "demo") { pages { path metrics { name p75 } } } }`, as the first M4 commit shipped it.
You can reproduce the shape with `git checkout 56d00b9 && npm run measure:queries -- --verbose`:

```
 1. select "id", "name", "created_at" from "sites" where "sites"."id" = ?
 2. select ... count(distinct ...) ... from "pageviews" ... group by ... "path"
 3. WITH ranked AS ( ... WHERE s.site_id IN (?) AND pv.path IN (?) ...      -- "/"
 4. WITH ranked AS ( ... WHERE s.site_id IN (?) AND pv.path IN (?) ...      -- "/pricing"
 5. WITH ranked AS ( ...                                                     -- "/docs"
 ...
12. WITH ranked AS ( ...                                                     -- "/settings"
```

Statements 3 to 12 are identical except for one parameter.
Nothing about the data required ten round trips; the resolver model produced them.
With a thousand pages it would be a thousand and two statements, and every one is a synchronous call into SQLite while the request waits.

Two tempting fixes do not survive contact with a real schema.
Fetching metrics inside the `pages` resolver "just in case" means the parent computes work for a child field the client may never have asked for, and the coupling spreads to every parent and child pair.
Reading `info` to peek at the selection set and conditionally pre-fetch works, but it moves the query's shape into the parent resolver, and the moment a second path to `Page` exists (say `Session.pageviews { page { metrics } }`) you write it again.

## What DataLoader does

DataLoader is small enough to describe completely:

1. You construct one per request with a batch function `(keys) => Promise<values>`.
2. Calling `load(key)` does not fetch anything.
   It records the key, returns a pending promise, and schedules the batch to run "soon".
3. "Soon" is after the current tick: once the synchronous work in progress and the promise jobs queued behind it have run.
   DataLoader uses `process.nextTick`-style scheduling (`enqueuePostPromiseJob`) for this.
4. When the batch runs, it receives every key loaded since the last batch and must return an array of values in the same order.
   That ordering contract is the one thing you can get wrong, and both of this repo's batch functions end with an explicit `keys.map(key => lookup(key))` for that reason.
5. Each key's result is memoised for the life of the loader, so loading the same key twice in one request fetches once.

Per request matters.
A loader shared across requests would hand user A a value cached for user B and would never see fresh data.
Pothos creates each loader lazily on first use and stores it on the request's context object, which is why `createContext` runs per request.

## When exactly the batch fires

Walk the three-statement version of the same query:

```
graphql-js                         DataLoader                SQLite
──────────                         ──────────                ──────
resolve Query.site ──────────────────────────────────────▶  1. select site
resolve Site.pages ──────────────────────────────────────▶  2. select ... group by path
  returns [p1 … p10]
resolve Page.metrics(p1)  ─ load(key1) ─▶ queue [key1]        (pending promise)
resolve Page.metrics(p2)  ─ load(key2) ─▶ queue [key1,key2]
   …
resolve Page.metrics(p10) ─ load(key10) ▶ queue [key1 … key10]
── end of tick ──────────────────────────▶ batch(keys) ──▶  3. WITH ranked ... path IN (?,?,?,?,?,?,?,?,?,?)
                                           returns [rows1 … rows10] in key order
resolve MetricSummary.* for every page (no queries)
```

The engine resolved all ten `metrics` fields synchronously, one after another, inside a single tick, because each resolver returned a pending promise immediately.
Only when the engine ran out of synchronous work did the batch fire, with all ten keys.
That is why the count is independent of N.

## What Pothos adds

`@pothos/plugin-dataloader` removes the plumbing.
`t.loadableList({ type, load, resolve })` means: `resolve` turns the parent into a key, `load` is the batch function over keys, and the plugin owns constructing the per-request loader, calling `load`, and mapping results back.
`loaderOptions` are passed straight to DataLoader; `cacheKeyFn` is set because the `Page.metrics` key is an object (`{ siteId, path, range }`) and DataLoader memoises by string.

One wrinkle you will hit: DataLoader insists the batch function returns a `Promise`, so the synchronous better-sqlite3 results are wrapped in `Promise.resolve`.

## Why the key carries the time range

`Page.metrics(from, to)` has arguments, and two fields in the same document could ask for different ranges.
The key therefore includes the range, and `batchLoadPageMetrics` groups keys by range and runs one statement per distinct range.
In the normal case every page shares the same range and it is one statement.
The percentile SQL was written to accept lists of sites and paths precisely so the batch could hand it everything at once.

## The second relation

`Session.pageviews` is a plain one-to-many: keys are session ids, the batch is `WHERE session_id IN (...)`, and `listPageviewsBySession` groups rows back per key.
It is there to show the pattern has nothing to do with percentiles.
Twenty sessions, three statements.

## The honest tradeoff

For `site { pages { metrics } }` on its own, one hand-written SQL statement joining pages to their percentiles would be faster and simpler than two statements and a loader.
The README decision entry says so.
DataLoader was chosen because the dashboard is a graph, not one query: the same `Page` appears under `Site.pages` and will appear under `Session.pageviews`, clients combine fields freely, and the batching contract composes across all of them without any resolver knowing the document's shape.
Knowing when the simpler option is good enough is part of the skill.

What is still naive, on purpose: `Site.pages` across many sites runs once per site.
With two seeded sites that is two statements.
Converting it is the exercise at the end.

## The percentile SQL

SQLite has no percentile function.
`src/db/queries/metrics.ts` does it in two steps inside one statement:

1. A CTE `ranked` joins events to pageviews and sessions, filters by site, path, and time range, and uses two window functions: `ROW_NUMBER() OVER (PARTITION BY site, path, name ORDER BY value)` gives each value its rank within its group, and `COUNT(*) OVER (PARTITION BY ...)` gives the group size `n`.
2. The outer query groups by (site, path, name) and picks the value whose rank equals `ceil(p * n)`.
   SQLite has no `CEIL`, so `(n * 75 + 99) / 100` does it with integer division.
   The rating buckets are `SUM(rating = 'good')` and friends; SQLite treats a boolean as 0 or 1.

This is the nearest-rank method: p75 is the smallest value such that at least 75% of samples are at or below it.
For five values 1000..5000 the ranks for p50/p75/p90 are 3, 4, 5, giving 3000, 4000, 5000, which is what the test asserts.
The range is half-open, `from <= recordedAt < to`, so "last 7 days" and "the 7 days before that" never both count the event on the boundary.

## Why every new file exists

- `src/db/query-counter.ts`: a Drizzle `Logger` that records statements.
  The instrument behind every number above; `makeDb` accepts it as an option so tests and the script can attach it.
- `src/db/queries/metrics.ts`: the window-function percentile statement, accepting many sites and paths.
- `src/db/queries/sessions.ts`: session listing and the grouped pageview lookup.
- `src/graphql/loaders/page-metrics.ts`: the batch function for `Page.metrics`, with the range grouping and the order-preserving return.
- `src/graphql/scalars.ts`: `DateTime`.
  GraphQL `Int` is 32-bit and epoch milliseconds are not, so the scalar carries numbers as ISO strings and rejects garbage with a clear error (tested).
- `src/graphql/enums.ts`: enum values cannot contain hyphens, so `needs-improvement` becomes `NEEDS_IMPROVEMENT` with an explicit mapping; the values still come from `src/vitals` so nothing can drift.
- `src/graphql/types/metrics.ts`: `MetricSummary` and `RatingBuckets`, backed directly by the SQL row; `p75Rating` is computed here because web.dev rates the p75.
- `src/graphql/types/sessions.ts`: `Session`, `Pageview`, and the `loadableList` relation.
- `scripts/measure-query-count.ts` and `npm run measure:queries`: prints statement counts per operation; `-- --verbose` prints the statements.
- Tests in `src/graphql/metrics.test.ts`: percentile and bucket maths on a five-value fixture you can check by hand, the half-open range, the `DateTime` rejection, and the two query-cost pins.
  The pins were written first and were red against the naive resolver before the conversion.

## How to see it working

```bash
npm run measure:queries              # the three numbers in the table above
npm run measure:queries -- --verbose # every statement, numbered
```

In GraphiQL:

```graphql
{
  site(id: "demo") {
    metrics { name p75 p75Rating sampleCount buckets { good needsImprovement poor } }
    pages {
      path
      metrics(from: "2026-10-01T00:00:00Z") { name p75 p75Rating }
    }
    sessions(limit: 5) {
      deviceClass connectionType userAgentFamily
      pageviews { path startedAt }
    }
  }
}
```

Change `from` to `"yesterday"` and read the error.

## Interview answers, in your words first

Write your own answer to each before opening the spoiler.

1. "What is the N+1 problem in GraphQL and how do you solve it?"
2. "Why is a DataLoader per request and not a module-level singleton?"
3. "When does DataLoader actually run the batch?"
4. "What is the one contract a batch function must honour?"
5. "When would you not use DataLoader?"

<details>
<summary>Reference answers</summary>

1. Execution calls child resolvers once per list item, so a child that queries per item issues N queries after the one that fetched the list. DataLoader collects every key requested in the same tick and fetches them in one batch, so the count stops depending on N. In this repo `site { pages { metrics } }` went from 12 statements to 3, measured and pinned by a test.
2. The loader memoises; shared across requests it would serve one user another's cached data and never observe writes. Per request, the cache lives exactly as long as the operation.
3. After the current tick: once the synchronous resolver calls for the list's items have all run and the promise jobs behind them have drained. Every `load` in that window joins one batch.
4. Return one value per key, in the same order as the keys. Missing keys get an empty value or an `Error`, never a shorter array.
5. When one root query can obviously return the whole shape and the schema is small and stable; a single SQL join is faster and simpler. Also for top-level fields, where there is nothing to batch. DataLoader pays for itself when many relations and arbitrary client-chosen selections meet.

</details>

## Exercise

Convert `Site.pages` to a `loadableList` keyed by site id.
`listPagesForSite` needs to accept many ids and group its rows; the test should then show `{ sites { pages { path } } }` costing 2 statements for any number of sites.
Measure before and after with the script and record both.
