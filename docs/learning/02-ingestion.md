# 02 - Ingestion

> Milestone 2 added `POST /api/collect`, the door through which real-user data enters the system.
> This chapter explains why `sendBeacon` exists, why deliveries are batched, why delivery must be idempotent, and what the validation protects against.

## What was built

- `POST /api/collect` accepts one batch: a session, one pageview, and that pageview's metric events.
- The payload is validated with zod at the boundary; every failure is a JSON error with a stable `code` and, where useful, the exact field that failed.
- Accepted batches are written in one transaction.
  Session and pageview inserts ignore conflicts, and metric events dedupe on the unique index from M1, so the response reports how many events were new and how many were duplicates.
- CORS is open (`Access-Control-Allow-Origin: *`) and an `OPTIONS` preflight is answered, because the library will run on other origins.
- The server recomputes each event's rating from its value; the client's opinion is not stored.

## Why `sendBeacon` exists

The most valuable moment to send performance data is the worst moment to make a network request: the user is leaving.
LCP is final only once the user interacts or the page is hidden.
CLS and INP keep changing for the life of the page and are only final at `pagehide`.
A normal `fetch` started in an unload handler may be cancelled when the document goes away, and in practice many such requests never arrive.

`navigator.sendBeacon(url, data)` hands the request to the browser and returns immediately.
The browser owns the delivery and will finish it after the page is gone.
The deal has conditions that shaped this endpoint:

- There is no response.
  The call returns `true` if the browser queued it, nothing more.
  So the endpoint's success body is for the `fetch` fallback and for tests, not for the beacon path.
- Payloads are capped, around 64 KB in practice.
  `MAX_BODY_BYTES` mirrors that so a request that would have been dropped by the browser is rejected explicitly here instead of silently.
- Only "simple" content types avoid a CORS preflight.
  A beacon sent as a plain string is `text/plain`; sent as a `Blob` of type `application/json` it is not, and some browsers then refuse to send it from `pagehide`.
  The endpoint therefore does not require a JSON content type: it reads the body as text and parses it.
- `fetch(url, { keepalive: true })` is the modern fallback with the same survive-unload promise and a response you can read.
  Both paths need the same request shape, which is why there is one.

## Why batching

Without batching, a page would make up to five requests, one per metric, each timed by when that metric happened to finalise.
Batching changes the contract to "one delivery per pageview, at the end", which:

- lets the browser library hold values until they are final rather than streaming deltas;
- means one row per metric per pageview in the database, with no reassembly;
- keeps the request count per visitor tiny, which matters when the site being measured is busy and the collector is a single SQLite file.

The batch is deliberately one pageview, not one session.
A single-page app navigates without unloading, and `web-vitals` reports metrics per navigation.
A pageview-sized batch maps one-to-one onto that, and a session is simply reconstructed on the server from the shared `session.id`.

## Why idempotent delivery matters

The library will flush on `visibilitychange` (hidden) and again on `pagehide`, because browsers disagree on which one fires reliably, and iOS Safari in particular drops `pagehide` in some cases.
A page restored from the back/forward cache reports its metrics again.
A `fetch` fallback may retry.
Every one of those is a legitimate second delivery of the same facts.

An endpoint that counted each delivery would overstate traffic and skew every percentile.
So the endpoint is idempotent: delivering the same batch twice leaves the database exactly as one delivery did.
The mechanism is the one M1 built for the seed.
The sender chooses the ids, the server inserts with `ON CONFLICT DO NOTHING`, and the unique index on `(pageview_id, name, metric_id)` turns a repeated event into a no-op that is counted in `duplicates` rather than stored.
No read-before-write, no race, one round trip.

Reusing the mechanism also covers the ordinary case that is not a retry at all: the second pageview of a session arrives with the same `session` object, and the session insert quietly does nothing.

## What the validation protects against

The payload arrives from the open internet.
Validation is the difference between a dashboard you can trust and one that is quietly wrong.

| Rule | What it prevents |
| ---- | ---------------- |
| Metric name must be one of the five | An old library version sending `FID`, or a typo, creating a metric the dashboard has no thresholds for. |
| Value in `[0, MAX_PLAUSIBLE_VALUE[name]]` | Negative timings, `NaN`, or a 20-minute LCP from a suspended laptop poisoning p75. |
| Timestamps are integer epoch ms, after 2020, not more than five minutes in the future | Second-vs-millisecond confusion, zeroed clocks, and wildly wrong client clocks landing outside every time range. |
| `path` starts with `/` and is bounded | Full URLs, query strings with tokens, or megabyte strings becoming "pages". |
| Device class and connection type are enums | Free-text dimensions that would never group. |
| At most `MAX_EVENTS_PER_BATCH` events; at most `MAX_BODY_BYTES` bytes | A buggy loop or a hostile client turning one request into a bulk insert. |
| Site must already exist | Random `siteId`s creating rows for sites nobody configured. |
| Rating is recomputed on the server | A client lying about, or disagreeing with, the thresholds. |

The error codes are the public contract for the library author: `invalid_json` (400), `invalid_payload` (422, with `issues[].path` like `events.0.value`), `batch_too_large` (413), `payload_too_large` (413), `unknown_site` (404).
A 202 means "stored", with `{ inserted, duplicates }`.

## Why every new file exists

- `src/collect/payload.ts`: the zod schema and the limits.
  It is a factory taking `now` because "not in the future" depends on the current time, and tests pass a fixed clock.
  The TypeScript type of a valid payload is inferred from the schema, so there is no second definition to drift.
- `src/collect/ingest.ts`: the transaction that persists a validated batch and counts inserted versus duplicate events using the `changes` count SQLite reports.
- `src/collect/handle.ts`: turns a `Request` into a `Response`.
  Size check, JSON parse, zod validation, site check, ingest, in that order, each failure mapped to a typed error.
  It is separate from the route file so tests can call it with a real `Request` and an in-memory database, which is the whole HTTP contract without a server.
- `src/app/api/collect/route.ts`: two lines of Next.js glue, `POST` and `OPTIONS`.
- `src/vitals/metrics.ts` gained `MAX_PLAUSIBLE_VALUE`, the per-metric ceiling, kept with the thresholds so the metric vocabulary stays in one file.
- Tests: `src/collect/handle.test.ts` (happy path with server-computed ratings and session reuse, exact duplicate delivery, six rejected payloads that store nothing, CORS headers) and `e2e/collect.spec.ts` (a scripted session posts a batch and the dashboard shows the page).
  The rejection table is the largest test in the repo on purpose: this is the trust boundary, and TESTING_RULES.md puts contract tests first.

## How to see it working

```bash
npm run dev
```

Deliver a batch by hand:

```bash
curl -s -X POST http://localhost:3000/api/collect \
  -d '{"siteId":"demo",
       "session":{"id":"manual-1","startedAt":'$(date +%s000)',"deviceClass":"desktop","connectionType":"4g","userAgentFamily":"curl"},
       "pageview":{"id":"manual-pv-1","path":"/hand-delivered","startedAt":'$(date +%s000)'},
       "events":[{"id":"m-lcp","name":"LCP","value":2100,"recordedAt":'$(date +%s000)'}]}'
# {"inserted":1,"duplicates":0}
```

Run the same command again and watch `duplicates` become 1.
Then change `"name":"LCP"` to `"name":"FID"` and read the 422 body.
Reload `http://localhost:3000` and `/hand-delivered` is in the table.

From the browser console on any page, the beacon path:

```js
navigator.sendBeacon("http://localhost:3000/api/collect", JSON.stringify({ /* same payload */ }));
```

Open the Network tab and note the request type is "beacon" and that there is no readable response.

## Self-check

1. Why does the endpoint accept a body with no `Content-Type: application/json` header?
2. A batch arrives twice. Walk through what the database does with the session row, the pageview row, and the three event rows the second time.
3. Why is the rating recomputed on the server rather than trusted from the client?
4. What would go wrong if the batch were one session instead of one pageview?
5. The test for rejected payloads asserts `countRows()` is all zeros. Which bug would that catch that checking only the status code would miss?

<details>
<summary>Answers</summary>

1. `sendBeacon` with a plain string sends `text/plain`, which is a CORS-simple request that needs no preflight and survives `pagehide` everywhere; requiring JSON would force a `Blob` and a preflight.
2. The session insert hits its primary key and does nothing; the pageview insert does the same; each event insert hits the unique index on (pageview_id, name, metric_id) and does nothing, so `changes` is 0 and the response reports three duplicates.
3. The threshold is a property of the dashboard's definition of "good", not of the client; recomputing keeps every stored rating consistent with `METRIC_THRESHOLDS` even if a client ships different numbers.
4. A single-page app would have to hold every pageview's metrics until the session ended, which it cannot know, and a tab closed mid-session would lose all of them; per-pageview batches flush as each navigation ends.
5. A handler that validates after writing, or writes the session before discovering the events are invalid, would return the right status while leaving partial rows behind.

</details>
