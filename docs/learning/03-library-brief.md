# 03 - The browser library: brief

> **This milestone is yours, Lakhte.**
> Claude Code wrote this brief and will write the review (`03-library-review.md`), and nothing else under `lib/vitals-client/`.
> Every line of the library, its build config, its tests, and its changelog is typed by you.
> When you are stuck, ask for a pairing explanation: concepts, diagrams, pseudocode for an analogous problem.
> Not the code.

## The goal in one sentence

A package, `lib/vitals-client`, that a site adds with two lines and that quietly delivers each pageview's Core Web Vitals to `POST /api/collect` in the exact shape the server already validates.

## The API contract (v1, and nothing more)

```ts
import { initVitals } from "vitals-client";

initVitals({ endpoint: "https://vitals.example.com/api/collect", siteId: "my-site" });
```

```ts
interface VitalsOptions {
  /** Absolute or relative URL of the collect endpoint. */
  endpoint: string;
  /** The site's public id; must already exist on the server. */
  siteId: string;
  /** 0..1, decided once per session. Default 1. */
  sampleRate?: number;
}

export declare const initVitals: (options: VitalsOptions) => void;
```

That is the whole public surface.
No callbacks, no custom dimensions, no attribution, no soft-navigation support in v1.
Restraint here is a feature a reviewer will notice.

## What the server expects

The contract is already written and tested, so you are integrating against something real:

- Shape: `src/collect/payload.ts` (zod) and the example in README "Collecting data".
- Rules and error codes: chapter 02, "What the validation protects against".
- Try it: `npm run dev`, then post with curl as chapter 02 shows, then break the payload on purpose and read the 422 body.

One batch is one pageview: `{ siteId, session, pageview, events }`.
`events[].id` is `metric.id` from `web-vitals`.
`events[].value` is `metric.value`.
`events[].recordedAt` is your `Date.now()` when the callback fired.
Do not send `rating`; the server computes it.
Do not `JSON.stringify` the whole `Metric` object; it carries `entries`, which are large and useless to the server.

## Read these first, in this order

1. `node_modules/web-vitals/README.md`: "Basic usage", "Batch multiple reports together", "Browser Support", "Limitations", and the `Metric` type under "API".
   Pay attention to *when* each metric's callback fires: LCP on first interaction or when hidden, CLS and INP when hidden, TTFB and FCP early.
2. MDN, `PerformanceObserver`: the primitive `web-vitals` wraps.
   You will not call it directly, but you should be able to explain what `web-vitals` saves you from.
3. Chrome's Page Lifecycle API guide, especially "Legacy lifecycle APIs to avoid".
   This is the argument for `visibilitychange` and `pagehide` over `unload` and `beforeunload`.
4. MDN, `Navigator.sendBeacon()` and the `keepalive` option of `fetch`.
   Note the return value of `sendBeacon` and what `false` means.
5. web.dev, "Back/forward cache": what `pageshow` with `persisted === true` means for a page that already sent its metrics.
6. web.dev, "Interaction to Next Paint": enough to explain why INP is only final when the page is hidden.
7. Node.js docs, "Packages": `"type": "module"`, the `exports` field, and why a package ships both ESM and CJS.
   Then the `tsup` README: what one `tsup src/index.ts --format esm,cjs --dts` command produces.
8. keepachangelog.com and semver.org, ten minutes each.

Glossary entries for most of these terms already exist in `GLOSSARY.md`; add any you find missing.

## What the library must do

**Capture.**
Register `onLCP`, `onCLS`, `onINP`, `onTTFB`, `onFCP` from `web-vitals` and queue each reported metric as `{ id, name, value, recordedAt }`.
Leave `reportAllChanges` off: you want final values, and the server dedupes by id anyway.

**Describe the pageview.**
`path` is `location.pathname`, never the full URL (query strings carry tokens).
`startedAt` is `Math.round(performance.timeOrigin)`.
`id` is a fresh `crypto.randomUUID()` per pageview.

**Describe the session.**
A session id that survives navigations within the tab: generate once, keep in `sessionStorage`, fall back to memory if storage throws (private mode does).
`startedAt` is when the id was minted.
Device class: `navigator.userAgentData?.mobile` is the modern signal; fall back to a small user-agent check; return `"unknown"` when you cannot tell.
Connection type: `navigator.connection?.effectiveType`, else `"unknown"` (Safari and Firefox do not have it; the dashboard shows that bucket honestly).
User-agent family: a coarse `Chrome | Safari | Firefox | Edge | Other`.
Do not add a UA-parser dependency; `web-vitals` is the only runtime dependency, and the README decision log says so.

**Sampling.**
Decide once per session (store the decision with the session id), so a sampled-out visitor is out for the whole visit rather than flickering per page.
`sampleRate: 0` must send nothing at all, and must not even register observers.

**Flush.**
Keep a queue.
On `visibilitychange` to `hidden` and on `pagehide`, serialise the batch, send it, and clear the queue.
Send with `navigator.sendBeacon(endpoint, body)` where `body` is a *string* (so the request is `text/plain` and needs no preflight).
If `sendBeacon` is missing or returns `false`, fall back to `fetch(endpoint, { method: "POST", body, keepalive: true })`.
Only send when the queue is non-empty.

**Survive a double flush.**
Both events can fire for one departure.
Clearing the queue after a successful hand-off is what stops the second event from resending.
Even if it did resend, the server would count duplicates and store nothing, which is the safety net, not the plan.

**Handle back/forward cache restores.**
On `pageshow` with `event.persisted`, the page is alive again and `web-vitals` will report fresh metrics with fresh ids.
Treat it as a new pageview: new pageview id, same session id.

**Be safe to import anywhere.**
`initVitals` must be a no-op when `window` is undefined, so a Next.js app can import it in a module that also renders on the server.
Calling it twice must not register observers twice.

## Package and build

- `lib/vitals-client/package.json`: `name` (your choice, scoped to you), `version: 0.1.0`, `type: module`, `main` (CJS), `module` (ESM), `types`, an `exports` map, `files: ["dist"]`, `sideEffects: false`, `dependencies: { "web-vitals": ... }`.
- `tsup` (or equivalent) producing `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`; `target` modern browsers; minify on.
- `tsconfig.json` with `strict: true` and `lib: ["DOM", "ES2020"]`.
- `README.md` with the two-line snippet and the options table.
- `CHANGELOG.md` in keep-a-changelog format starting at `0.1.0`.
- Tests of your choosing (Vitest with `happy-dom` or `jsdom` is the usual pairing).
  Worth testing: the payload shape your serialiser produces from a fake `Metric`; device/connection detection with stubbed navigator values; that `sampleRate: 0` registers nothing; that a flush empties the queue.
  Not worth testing: `web-vitals` itself, or the browser's beacon implementation.
  Apply `TESTING_RULES.md`.

## Acceptance criteria

You are done when all of these are true and you can explain each one:

1. `npm run build` inside `lib/vitals-client` emits ESM, CJS, and `.d.ts`; `npm pack --dry-run` lists only `dist/`, `README.md`, `CHANGELOG.md`, `package.json`, and `LICENSE`.
2. The only runtime dependency is `web-vitals`.
3. Open a page using the library, switch tabs: exactly one `POST` to the endpoint appears in the Network tab, type "beacon", and the server logs a 202 (check with `curl` against a dev server or watch the dashboard update).
4. Interact with the page before leaving: an `INP` event arrives.
5. Reload, press Back to return via bfcache: a second pageview with the same session id arrives.
6. On Safari (or with `navigator.connection` stubbed out) the session reports `connectionType: "unknown"` and nothing throws.
7. `sampleRate: 0` produces no network traffic and no observers.
8. `initVitals` is a no-op under `node` (`node -e 'import("./dist/index.js").then(m => m.initVitals({endpoint:"x",siteId:"y"}))'` exits cleanly).
9. The gzipped size of `dist/index.js` is measured and written into the README metrics table with the command used (`gzip -c dist/index.js | wc -c` is enough).
10. The dashboard dogfoods it: a small client component in `src/app/` calls `initVitals({ endpoint: "/api/collect", siteId: "vitals-dashboard" })`, and your own sessions appear under "Vitals dashboard (self-measured)" after you navigate around and switch tabs.
    The `vitals-dashboard` site is already seeded.
11. `CHANGELOG.md` has a `0.1.0` entry listing what shipped.

## Known pitfalls

- **iOS Safari and `pagehide`.**
  Historically unreliable when the user switches apps or closes the tab from the tab switcher; `visibilitychange` to `hidden` fires in more of those cases.
  Listen to both; rely on the queue-clearing to stay idempotent.
- **Losing the final INP.**
  `web-vitals` reports INP from its own `visibilitychange` listener.
  If your flush listener runs before theirs, the INP value is not in your queue yet.
  Listeners fire in registration order on the same target, so register your flush listener *after* calling the `on*` functions, and be able to explain why that works.
- **`sendBeacon` returning `false`.**
  It does, when the browser's beacon quota is full.
  That is what the `fetch` fallback is for.
- **Serialising the metric.**
  `JSON.stringify(metric)` includes `entries` (PerformanceEntry objects) and can be tens of kilobytes.
  Map to the four fields you need.
- **`sessionStorage` throwing.**
  Private browsing and some embedded webviews throw on access.
  Wrap it; fall back to memory.
- **Clock skew.**
  The server rejects timestamps more than five minutes ahead of its own clock.
  Use `Date.now()`, not `performance.now()` (which is relative to the page's time origin).
- **`startsWith("/")`.**
  The server rejects a path that is not a pathname.
  `location.pathname` always qualifies; `location.href` never does.
- **Double registration.**
  Hot reloading in the dashboard will call `initVitals` more than once.
  Guard it.

## Suggested shape (names, not code)

```
lib/vitals-client/
├── src/
│   ├── index.ts         initVitals: guards, sampling decision, wiring
│   ├── session.ts       session id + startedAt + sampling decision, storage fallback
│   ├── environment.ts   device class, connection type, UA family
│   ├── queue.ts         push / drain / isEmpty
│   └── transport.ts     send(body): beacon, then keepalive fetch
├── test/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
└── CHANGELOG.md
```

Keep each file under a hundred lines.
If one grows past that, something wants to be its own module.

## How the review will work

Commit as you go, small commits, conventional messages.
When you want eyes on it, say so; Claude Code reads the library and writes `docs/learning/03-library-review.md` in the style of a colleague's pull-request review: specific lines, the concept behind each comment, no patches.
You revise; the review gets a second pass; repeat until both of us are satisfied.
Then you write the closing section of chapter 03 in your own words: what you learned, what surprised you, what you would do differently.

## Self-check before you start

1. Which metric callbacks fire early, and which only when the page is hidden?
2. Why is a string body better than a `Blob` with `type: "application/json"` for `sendBeacon`?
3. Why must the session id live in `sessionStorage` rather than a module variable?
4. What happens on the server if your library accidentally sends the same batch twice?
5. Why does the library not need to compute `rating`?

<details>
<summary>Answers</summary>

1. TTFB and FCP fire early; LCP fires on first interaction or when hidden; CLS and INP fire only when hidden (and again if the page becomes visible and hidden again).
2. A string is sent as `text/plain`, a CORS-simple request that needs no preflight and is deliverable during unload everywhere; a JSON `Blob` triggers a preflight that some browsers will not perform from `pagehide`.
3. A module variable dies with the page; a full navigation to the next page would mint a new session id and split one visit into many sessions.
4. Nothing is stored twice: the session and pageview inserts hit their primary keys and do nothing, each event hits the unique (pageview, name, metric id) index, and the response reports them as duplicates.
5. The server recomputes it from `value` using the same `web-vitals` thresholds, so stored ratings can never disagree with the dashboard's definition of good.

</details>
