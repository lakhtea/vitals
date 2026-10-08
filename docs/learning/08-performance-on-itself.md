# 08 - Performance on itself

> Milestone 8 is the self-referential one: the dashboard gets a stress seed, virtualised tables, a bundle budget, and it measures itself with its own library.
> Concept sections are written first; measured numbers and the file list are added as each piece lands.

## What a stress seed is for

Fifty sessions prove the code is correct.
They prove nothing about how it behaves when a table has two thousand rows or a percentile query scans a hundred thousand events.
The stress seed (`npm run db:seed:stress`) generates roughly 100,000 metric events across roughly 2,000 sessions with the same deterministic generator as the demo seed, under its own id prefix so it is idempotent and can coexist with everything else.

It is behind a flag because the unit tests and the e2e suite must stay fast, and because the demo site should look like a small real site, not a load test.

Measured on the development machine (SQLite 3.53, WAL mode): 2,000 sessions, 21,265 pageviews, 100,136 metric events in 0.8 seconds of in-process time (just over a second of wall time including startup).
A second run inserted nothing and left every count identical.
Running the normal demo seed on top added exactly its own 50 sessions, 104 pageviews, and 487 events.
One SQLite detail worth knowing: rows skipped by `ON CONFLICT DO NOTHING` still consume `AUTOINCREMENT` ids, so after a re-run the sequence is ahead of `max(id)`; harmless, but it explains the gaps.

Inserting that many rows teaches one SQLite fact immediately: a single `INSERT ... VALUES (...), (...)` is limited by the number of bound parameters (32,766), so the seed writes in chunks inside one transaction.
One transaction, because SQLite commits are the expensive part, not the inserts.

## What virtualisation actually does

A table with two thousand rows creates two thousand `<tr>` elements, each with five cells, each a DOM node with layout, style, and paint cost.
The browser lays all of them out even though the viewport shows twenty.

Virtualisation renders only the rows that intersect the viewport plus a small overscan, inside a container whose height is set to what the full list *would* occupy, so the scrollbar is honest.
As the user scrolls, the rendered window slides: rows leaving the top are unmounted, rows entering the bottom are mounted, and each row is absolutely positioned (or offset with a spacer) at the pixel where it belongs.

The cost moves from "N rows of layout" to "visible rows of layout plus a scroll handler".
The price is complexity: row heights must be known or measured, keyboard navigation and find-in-page only see rendered rows, and screen readers need the total count announced because the DOM no longer contains it.

The measurement that justifies it is render time of the sessions table with the stress seed, before and after, taken with a committed script rather than a screenshot of devtools.

## How to read a bundle budget

`next build` prints, per route, the "First Load JS": the JavaScript the browser must download and execute before the route is interactive, shared chunks included.
That number is the tax every visitor pays before the dashboard can respond to a click.

A budget turns a number you glance at into a number you cannot regress: a committed baseline, a script that reads the build output and compares, and a CI step that fails above baseline plus a tolerance (ten percent here).
The tolerance exists so an unrelated dependency bump does not block a release; the baseline is updated deliberately, in a commit that says why.

The usual causes of a jump are worth knowing by name: a server-only module imported from a `"use client"` file, a date or utility library pulled in whole, a chart library, or `"use client"` placed too high in the tree so the whole page becomes client bundle.

## The self-instrumentation loop, end to end

1. The dashboard's layout loads the browser library (Lakhte's `vitals-client`) with `siteId: "vitals-dashboard"` and `endpoint: "/api/collect"`.
2. A visitor opens the dashboard; `web-vitals` measures LCP, CLS, INP, TTFB, FCP for that pageview.
3. On tab hide or unload, the library posts one batch to `/api/collect`.
4. The endpoint validates and stores it under the `vitals-dashboard` site, next to the synthetic `demo` site.
5. The "This site, measured by itself" panel queries `site(id: "vitals-dashboard") { metrics }` and shows the dashboard's own p75s.

The loop is the honest version of a performance claim.
A Lighthouse score is a lab run on one machine; the panel shows what real visitors to the public demo actually experienced, computed by the same code path as every other site's numbers.
If the dashboard ships a layout shift, its own CLS card says so.

## Why every new file exists (so far)

- `scripts/seed-db.ts`: the CLI for both seeds (`db:seed`, `db:seed:stress`), kept out of `src/db/seed.ts` so the db module can import the seed for demo mode without an import cycle.
- `src/db/synthetic/traffic.ts` gained a `profile` option (`demo` or `stress`) holding the id prefix, time window, and pageviews-per-session mix; the demo profile produces byte-identical output to before, verified by hashing the generated rows.
- `src/db/seed.ts` gained `seedStress` and chunked inserts for both seeds.

Remaining M8 pieces (virtualised sessions table with its measurement, the bundle budget, and the self-measurement panel) are added here when they land.

## Self-check

1. Why does the stress seed chunk its inserts, and why inside one transaction?
2. A virtualised table shows 2,000 rows. Roughly how many `<tr>` elements exist in the DOM at any moment, and what makes the scrollbar the right length?
3. What is "First Load JS" and why is a tolerance built into the budget?
4. Name two things that commonly make a route's First Load JS jump.
5. Why is the self-instrumentation panel a stronger claim than a Lighthouse score?

<details>
<summary>Answers</summary>

1. SQLite caps bound parameters per statement at 32,766, so a 100,000-row insert must be split; wrapping the chunks in one transaction avoids paying a commit per chunk, which dominates the cost.
2. Only the visible rows plus overscan, typically a few dozen; the container's height is set to the total rows times row height, so the browser draws a scrollbar for the whole list.
3. The JavaScript downloaded and executed before the route is interactive, shared chunks included; the tolerance lets unrelated small changes pass while still catching real regressions, with the baseline moved only on purpose.
4. Importing a server-only or heavy utility module from a client file, and placing `"use client"` high enough that the whole page enters the bundle; a chart library is the classic third.
5. It is field data from real visitors on real devices, collected and aggregated by the same code as any other site, rather than one synthetic lab run; it also cannot be cherry-picked, because it is live.

</details>
