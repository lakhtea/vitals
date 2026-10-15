# 12 - Incidents and health checks

> Milestone 12 turned the dashboard from a place that shows numbers into a place that says what is wrong.
> This chapter explains detection as statistics (why a p75 comparison needs a sample floor and two windows), the incident state machine and who may move it, why health checks are pushed rather than pulled, what the write key protects against, and how the first detail route is built.

## What was built

- Three tables: `checks` (every health observation an application reports), `incidents` (what the detector decided a person should look at, with JSON evidence), and `incident_steps` (the timeline: agent work from M15, human decisions from now).
  `sites` gained a `write_key`.
- `POST /api/checks`: any application pushes a batch of health-check results with the site's write key as a bearer token.
  Validated with zod, idempotent on (site, check id, observed time), typed errors like `/api/collect`.
- The detector: pure rules in `src/incidents/detector.ts`, the database round trip in `src/incidents/detect.ts`, run by `npm run incidents:detect`, by the `detectIncidents` GraphQL mutation, and on every demo-mode cold start.
- GraphQL: `Site.checks`, `Site.incidents`, `Query.incident`, and the mutations `detectIncidents`, `approveIncident`, `dismissIncident`.
  Illegal status moves are refused with a typed error.
- UI: a health panel and an incidents table on the overview, and the first detail route, `/incidents/[id]`, server-rendered with the evidence and the timeline, plus the approve and dismiss form (the human gate).
- Seed: a deliberate LCP regression on `/pricing` (the same thirty visitors on two consecutive days, LCP multiplied by 2.5 on the second) and a failing `api-health` check, so `npm run db:seed && npm run incidents:detect` opens exactly two incidents on a fresh database.
  Measured: `/pricing` p75 LCP goes from 2,861 ms (needs improvement, 33 samples) to 7,153 ms (poor, 32 samples), a relative increase of 1.50; every other metric on the path is unchanged between the windows.

## Detection as statistics

### Why not alert on a threshold

The obvious detector says "open an incident when p75 LCP is above 2.5 s".
It fails twice.
A page whose p75 has always been 2.6 s pages someone every day for nothing; a page that went from 1.0 s to 2.4 s overnight, a real regression, never pages anyone.
A regression is a change, so the detector has to compare against the page's own past.

### Two windows

The detector takes two half-open windows of equal length: the current one, `[now - 24h, now)`, and the baseline, the 24 hours before it.
For every (path, metric) it computes the p75 in each window with the same window-function SQL the dashboard uses (chapter 04), then the relative increase `(current - baseline) / baseline`.
Relative, not absolute, because 500 ms on a 1 s TTFB is a disaster and 500 ms on a 6 s LCP is noise.

### The sample floor

A percentile is a statement about a distribution, and five loads are not a distribution.
The p75 of five values is the second-largest one; replace a single visitor on a slow train and it doubles.
So a pair of windows is only judged when both hold at least `minSampleCount` (20) samples.
Below the floor the detector says nothing, on purpose: silence on a quiet page costs less than a false page at 3 a.m.
This is also why the seed's regression fixture adds thirty pageviews per window rather than three: the detector has to be able to find it honestly.

### Two triggers, and why a band change alone is not one

The detector fires when the relative increase is at least 50%, or when it is at least 20% and the web.dev rating band also got worse (good to needs-improvement, needs-improvement to poor).
It never fires on a band change alone.
Picture a page whose p75 LCP hovers at 2.45 s to 2.55 s; it crosses the 2.5 s line most days in one direction or the other.
A band-only trigger opens an incident every other day for a page that has not changed.
Requiring a 20% move alongside the band change means the band crossing has to come with real movement.

### Health checks: first failure, third degradation

A `failing` observation opens an incident immediately; a service that says it is down should be believed.
A `degraded` observation has to repeat three times in a row.
Degraded is the state in which flapping lives (one slow query, one GC pause), and three consecutive observations is the cheapest filter for it.
The evidence records the streak length and the status before it, so the detail page can say "Failing for 2 observations (was OK)".

### Opening, resolving, and never overwriting a person

Each run reconciles findings with the `incidents` table.
A finding with a live incident for the same (site, source, subject, metric) changes nothing.
A finding without one opens an `open` incident with the evidence frozen as of that run.
An `open` health-check incident whose finding has gone is resolved immediately: its latest observation is no longer failing.
A vitals regression is harder, because "no finding" does not mean "fixed".
If a page gets slow and stays slow, after two days both windows are full of slow loads, the comparison goes quiet, and the page is exactly as slow as when the incident opened.
So an open vitals incident resolves only on evidence of recovery: the current window must hold at least 20 samples for that path and metric, and its p75 must be within 20% of the baseline p75 frozen in the incident's evidence (`hasVitalsRecovered` in the detector).
No data is not evidence, so an incident on a page that stops getting traffic stays open until a person closes it.
This was a bug in the first version of the reconciler, caught in review: it resolved any open regression a day after detection, and the scenario test that now pins the fix fails against that version.
Every other status is off limits to the detector: `approved`, `dismissed`, and the agent states belong to people and to the pipeline.

A dismissal has to mean something.
The regression a person just dismissed is usually still in the data, so a naive detector would open a fresh incident for it on the very next run.
Instead a `dismissed` incident blocks a new one for the same subject for one window (24 hours from the decision, measured from the incident's `updated_at`, which the decision sets).
After that, if the finding still fires, a new incident opens beside the dismissed one with fresh evidence: the person said "not now", not "never".
The partial unique index on live incidents makes "one live incident per subject" a database guarantee, not a convention.

### What the rules get wrong, measured

The rules were run against data with no regression in it, and they fired anyway.
On the stress data set (two thousand sessions of stationary synthetic traffic), comparing two ordinary days opened four CLS incidents: `/` (+86%, good to needs improvement), `/blog` (+230%), `/dashboard` (+45% with a band change), and `/login` (+163%), on 40 to 240 samples per window.
Nothing had changed; the cause is the shape of CLS.
Most loads shift nothing and a few shift a lot, so the 75th percentile sits on a sparse stretch of the distribution, and a few dozen samples moving one way or the other move the p75 by tens of percent.
The sample floor of 20 is enough for timings and not enough for CLS.

What was done about it, and what was not:

- The stress seed's traffic now ends two windows before `now`, so the benchmark data never sits inside the detector's windows; its counts and values are unchanged, so the README's stress numbers still hold.
  A stress-only database therefore shows nothing in the dashboard's last-24-hours range; use "All time".
- The rules were not tuned to make the false positives disappear.
  A per-metric floor (higher for CLS) or a confidence interval on the percentile is the honest fix, and it belongs in a rules revisit with its own measurement, not in a quiet constant change.
- A baseline p75 of zero is never judged, because a relative increase from zero is infinite.
  That hides a real regression from a perfectly stable layout to a shifting one; an absolute-change rule for CLS would catch it.
- Low-traffic pages never reach the floor, and a slow creep of a few percent a day never crosses 20% between two adjacent days.
  Both are accepted for now, as the README decision entry says.

The planted `/pricing` fixture is shaped around the same weakness.
Its thirty visitors arrive at the same times on both days, so the only thing that differs between the windows is the LCP multiplier; with independent visit times, a detector run an hour after the seed opened spurious FCP and CLS incidents on the same path.
About twelve hours after seeding, the current window drops under the floor and the fixture ages out quietly.

## The incident state machine

```
open -> triaged -> fix-proposed -> reviewed -> awaiting-human
  |        |            |             |             |
  +--------+------------+-------------+-------------+--> approved --> resolved
  |        |            |             |             |
  +--------+------------+-------------+-------------+--> dismissed
  |
  +--> resolved  (detector only, when the condition clears)
```

`INCIDENT_TRANSITIONS` in `src/incidents/vocabulary.ts` is the table; `isTransitionAllowed` is the only question anyone asks before writing a status.
Agents (M15) walk the top row.
A person may approve or dismiss from any live state, which is why the buttons appear on an `open` incident today with no agent in sight.
`dismissed` and `resolved` are terminal: nothing moves out of them.
A later finding for the same subject opens a new incident with its own evidence rather than reviving the old one, after the one-window hold a dismissal buys.
The GraphQL mutations refuse an illegal move with an error that names both statuses, and the refused move writes nothing.

Every human decision is also a step: `incident_steps` gets a row with role `human`, the decision as its summary, and the note as its detail.
From M15 the four agents write their steps into the same table, so one ordered list tells the whole story of an incident.

## Why checks are push-first, and what the write key protects against

The triage agents should be able to serve any application, not only this one.
Two ways to learn an application's health: pull it (Vitals calls the application's health endpoint on a schedule) or have the application push it.
Pulling means an adapter per shape of health endpoint and a scheduler that must run somewhere; pushing means one documented contract that the application, or the monitoring it already has, can hit with a cron job or a webhook.
Push came first; M13 adds one generic HTTP probe that turns any `/healthz`-style endpoint into a push, which proves the contract against an application we do not control without building a connector framework.

`/api/collect` is open to the world because a browser cannot keep a secret: a key in a web page is public the moment the page loads.
`/api/checks` is different.
It is called by servers, which can keep a secret, and a forged `failing` check would open an incident that an agent then spends money trying to fix.
So every site may hold a `write_key`, presented as `Authorization: Bearer <key>`; a missing or wrong key is a 401, and a site with no key accepts no checks at all.
A shared secret is enough for a self-hosted single-tenant tool; signed requests or per-application keys would be the first change for multi-tenant hosting.

## Why every new file exists

The M12 files, grouped by concern.

Vocabulary and schema:

- `src/checks/status.ts`: the three check statuses, worst first, so the health panel can sort by severity without a lookup table.
- `src/incidents/vocabulary.ts`: sources, statuses, the transition table, the human decisions, step roles and statuses.
  One file, so the state machine is written down exactly once.
- `src/incidents/evidence.ts`: the TypeScript shapes of the JSON evidence column, per source.
  The detector writes them, the API and the UI read them; a change here is a typecheck failure everywhere it matters.
- `src/db/schema.ts` and `drizzle/0001_incidents_and_checks.sql`: the three tables, the `write_key` column, and the partial unique index.
  Generated with `npm run db:generate`; the SQL is committed so a reviewer can read what the database actually enforces.

Detection:

- `src/incidents/detector.ts`: `DETECTION_RULES` and the pure functions `findVitalsRegressions`, `findCheckFailures`, and `hasVitalsRecovered`.
  No database, so the rules can be tested on hand-sized inputs.
- `src/incidents/detect.ts`: loads the two windows and the check history, runs the detector, reconciles with the table in one transaction.
- `src/db/queries/metrics.ts` gained a per-path window summary for a whole site, the same window-function statement grouped by path.
- `src/db/synthetic/regression.ts` and `src/db/synthetic/checks.ts`: the deterministic fixtures the detector finds.
  The regression reuses the traffic generator's `/pricing` profile with LCP multiplied; the checks fixture skips itself when the site already has observations, because observed times depend on the clock and cannot dedupe by index.
- `src/db/seed.ts`: write keys for the two seeded sites (set on conflict too, so an older database gets them), the two fixtures in the demo plan only, and the stress plan's traffic ending two windows before `now` (see "What the rules get wrong").
- `src/db/synthetic/traffic.ts`: its building blocks (path profiles, visitor picking, metric sampling) are now exported so the regression fixture reuses them; the generated rows are byte-for-byte what they were.
- `src/db/index.ts`: the demo cold start runs detection after the seed, so the hosted demo shows incidents.
- `scripts/detect-incidents.ts`: the CLI behind `npm run incidents:detect`.

Health-check ingestion:

- `src/checks/payload.ts`, `ingest.ts`, `handle.ts`, `src/app/api/checks/route.ts`: the same four-part shape as `src/collect`, plus the bearer-token check and no CORS (servers do not need it).
- `src/db/queries/checks.ts`: newest observation per check in one statement, and a check's history.

API:

- `src/graphql/enums.ts`: the five new enums, values taken from the vocabulary modules.
- `src/graphql/types/checks.ts` and `types/incidents.ts`: `Check`, `Incident`, the two evidence types, `WindowSummary`, `IncidentStep`, `DetectionResult`.
- `src/graphql/schema.ts` and `builder.ts`: `Site.checks`, `Site.incidents`, `Query.incident`, and the first mutations this schema has had.
- `src/db/queries/incidents.ts`: listing, lookup, steps, and `decideIncident`, the one transaction that validates the move, updates the row, and writes the human step.

UI:

- `src/dashboard/incidents.ts`: labels, tones, `incidentTitle`, `describeEvidence`.
  Text decisions in one file so the table, the detail page, and the stories agree.
- `src/dashboard/components/HealthPanel.tsx`, `IncidentsTable.tsx`, `IncidentDetail.tsx`: hook-free leaves a Server Component can render into the first HTML.
  The overview renders the first two inside `DashboardView`; the incident page renders `IncidentDetail` directly from its Server Component.
- `src/dashboard/components/IncidentActions.tsx`: the one `"use client"` component, because a textarea has state.
- `src/dashboard/components/IncidentDecision.tsx`: runs the approve or dismiss mutation, then calls `router.refresh()` so Next.js re-renders the page's Server Components with the decision in them.
  The alternative, a client component that owns the whole incident and patches it with the mutation's result, would have pulled the evidence and timeline into the browser bundle for no benefit; refreshing keeps them server-only and keeps the note the person typed, because a refresh preserves client state.
- `src/dashboard/components/IncidentPage.module.css`: the incident page's column and the decision box.
- `src/dashboard/adapters.ts`: GraphQL enums and evidence to the domain shapes the components take.
  The evidence column is one JSON value, but GraphQL carries it as two nullable objects (`vitalsEvidence`, `checkEvidence`) because a union would have to be queried with fragments on every client; `toIncidentEvidence` puts it back together.
- `src/app/incidents/[id]/page.tsx`: the route, a Server Component.
  `params` is a Promise in this Next.js; an unknown id calls `notFound()`; `connection()` keeps it from being prerendered, because a decision changes it.
- `src/dashboard/incidents.test.ts`: the two sentences a person reads first, the title and the evidence line, pinned word for word.
- `src/dashboard/queries.ts`: the `DASHBOARD` document grew `checks` and `incidents`; `INCIDENT`, `APPROVE_INCIDENT`, and `DISMISS_INCIDENT` are new.

Tests (per TESTING_RULES, the smallest set that defines correctness):

- `src/incidents/detector.test.ts`: the rules on hand-sized inputs.
- `src/incidents/detect.test.ts`: the seed opens exactly two, a rerun opens none, a dismissed incident is never touched, a recovered check resolves, the stress seed is detector-clean.
- `src/checks/handle.test.ts`: the contract, with the rejection table storing nothing.
- `src/graphql/incidents.test.ts`: decisions and refusals, evidence per source, latest-per-check, and a query-count pin.
- `e2e/incidents.spec.ts`: the regression is listed, a person dismisses it by keyboard alone, and axe passes on the detail page.

## How to see it working

```bash
npm run db:seed
npm run incidents:detect        # detect: opened 2, resolved 0, unchanged 0
npm run incidents:detect        # detect: opened 0, resolved 0, unchanged 2
npm run dev
```

Open `http://localhost:3000`.
Under the metric cards, the incidents table lists "LCP on /pricing" and "API health"; the health panel shows `api-health` failing beside two healthy checks.
Click "LCP on /pricing": the evidence section shows the two windows side by side, with the baseline p75 in the needs-improvement band and the current one poor.
Type a note and press Dismiss; the status pill changes and the timeline gains a human step with your note.
Run `npm run incidents:detect` again: the dismissed incident stays dismissed.

Post a recovery for the check and watch it resolve:

```bash
curl -s -X POST http://localhost:3000/api/checks \
  -H 'authorization: Bearer demo-write-key' \
  -d '{"siteId":"demo","checks":[{"id":"api-health","name":"API health","status":"ok","observedAt":'$(date +%s000)'}]}'
npm run incidents:detect        # detect: opened 0, resolved 1, unchanged 0
```

Try the key: drop the header and read the 401; send the same observation twice and watch `duplicates` become 1.

In GraphiQL (`/api/graphql`), run the mutation by hand and read the refusal:

```graphql
mutation { dismissIncident(id: "1") { status } }
```

If incident 1 is already dismissed, the error names both statuses and nothing changes.

## Self-check

1. Why does the detector compare two windows instead of checking p75 against the web.dev threshold?
2. A page gets 4 pageviews a day. Its p75 LCP triples. What does the detector do, and why is that the right answer?
3. Why is a rating-band change on its own not a trigger?
4. The detector runs while an incident is `approved` and the regression has cleared. What happens to the incident?
5. Why does `/api/checks` require a key when `/api/collect` does not?
6. Why is the "one live incident per subject" rule a partial unique index rather than a plain unique index?
7. On two days of identical synthetic traffic the detector opened four CLS incidents. Why CLS and not LCP, and why was the fix not simply raising `minSampleCount`?

<details>
<summary>Answers</summary>

1. A threshold measures a level, not a change; a page that has always been slightly over the line would page forever, and a real regression that stays under the line would never page. Comparing the page to its own recent past detects change.
2. Nothing: with 4 samples in a window the pair is under the sample floor of 20, so it is not judged. A percentile of four values is not a measurement, and a false page costs more trust than a missed one on a page that quiet.
3. A p75 that sits near a threshold crosses it on ordinary variation, so a band-only trigger opens incidents for pages that have not changed. The band change has to come with at least a 20% move.
4. Nothing. The detector only resolves incidents in `open`; `approved` belongs to the person who approved it and, later, to the pipeline that closes it when the fix lands.
   (And an `open` regression would resolve only if the current window showed the p75 back within 20% of the baseline frozen at detection, with at least 20 samples.)
5. A browser cannot keep a secret, so a key in a web page protects nothing and `/api/collect` is open by design. Health checks come from servers, which can keep a secret, and a forged failing check would open an incident and spend an agent's budget, so the server has to prove it is allowed.
6. Resolved and dismissed incidents stay in the table as history. A plain unique index on (site, source, subject, metric) would forbid ever opening a second incident for a subject once the first was resolved; the `WHERE status NOT IN ('dismissed', 'resolved')` clause makes the uniqueness apply only to live incidents.
7. CLS is mostly zeros with a heavy tail, so its p75 lands on a sparse part of the distribution where a few samples move it a lot; timings are smooth log-normals and their p75 is stable at the same sample size. Raising the global floor would also silence real timing regressions on mid-traffic pages; the right fix is per-metric (a higher floor or a confidence interval for CLS), and it should be measured, not guessed.

</details>
