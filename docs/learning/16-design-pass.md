# 16 - Design pass and page detail

> Milestone 16 made the dashboard look like the product it already was.
> Nothing about the data changed; what changed is that the same numbers now have a hierarchy, a trend, and a place to drill into.
> This chapter explains what a design token is and why a scale beats hand-picked values, how one series feeds both a sparkline and a chart, how the time series is bucketed in SQL, why the two routes keep their filter state in different places, and what the bundle budget saw.

## What was built

- A token set in `src/app/globals.css`: a type scale, a 4 px spacing scale, radii, a surface hierarchy, one accent, and the rating colours with soft variants, in light and dark.
  Every component styles only against those variables.
- GraphQL: `SeriesBucket` (HOUR, SIX_HOURS, DAY), `Site.series` and `Page.series` returning p75 per bucket for all five metrics from one statement, `Site.page(path)`, `Page.sessions`, and `Page.breakdown` (p75 per metric by device class and by connection type).
- The overview: a sticky toolbar, an attention strip that says what is wrong before anything else, metric cards with sparklines, one trend chart with a metric switcher, incidents and health demoted below the vitals, tables with rating dots, and a path link into the page detail.
- The incident page: a header band, a before/after figure pair with threshold bars, a vertical timeline with a role icon per step, the proposed change with a file list, and a restyled decision card.
- A page detail route, `/sites/[siteId]/pages/[[...path]]`, with the path's cards, trend, breakdowns, and sessions; its filters live in the URL.
- Screenshots before and after under `docs/screenshots/`.

## Design tokens, and why a scale

A design token is a named value, `--space-4` or `--rating-poor`, defined once and referenced everywhere.
The name is the point: a component that says `padding: var(--space-4)` is saying "one unit of the layout's rhythm", not "16 pixels", and when the rhythm changes it changes in one file.

Before this milestone the dashboard had tokens for colour and nothing else.
Each component chose its own font sizes (`0.8rem` here, `0.875rem` there, `0.9375rem` for a heading), its own paddings, its own radius.
None of those choices was wrong on its own; together they had no relationship, which is what "plain" looks like.

A scale fixes that by making the choices discrete.
The type scale here steps by 1.125 (`--text-xs` 0.75 rem up to `--text-3xl` 2.25 rem), so any two sizes used side by side differ by a ratio the eye recognises.
Spacing is on a 4 px grid, so gaps inside a card, between cards, and between sections are multiples of one unit.
Surfaces are ordered by elevation: the page background, a sunken well for secondary content, a card, a raised panel, and a component picks the surface for its depth rather than a colour.

The font is the platform's own UI face (`ui-sans-serif, -apple-system, "Segoe UI", ...`).
A web font would make every screenshot identical and cost 50 to 100 KB plus a build-time download CI would depend on; the system face costs nothing and matches the OS the person is reading on.
The README Decisions entry records that tradeoff.

Two rules make the tokens stick.
Components reference tokens and never raw values, so a reviewer can grep a stylesheet for a digit and ask why it is there.
And dark mode is only the token layer: the `prefers-color-scheme` block redefines the surfaces, the accent, and the rating colours, and no component knows which mode it is in.

## One series, two views

A sparkline is a line with no axes: it shows shape, not value, and sits beside the number that carries the value.
The trend chart shows the same series with axes, the web.dev rating bands, and threshold lines.

Both draw from `src/dashboard/chartScale.ts`, the pure module from M6: `scaleLinear` maps a domain to a pixel range, `buildLinePath` turns points into an SVG path, `summarizeSeries` finds the first, last, min, and max.
`Sparkline` uses the min and max of its own points as the vertical domain, so any series fills its 32 px box; `TimeSeriesChart` uses zero to the next round tick above the larger of the data and the poor threshold, so position answers "is this good?".
The two never disagree about where a point sits in time because they share the scale function and the same sorted points.

`MetricTrend` owns one piece of state, the selected metric, and renders the five metric codes as a tab list with roving focus: one Tab stop, arrows to move between metrics.
The first paint draws LCP in the server HTML, so a visitor without JavaScript still sees a chart.

## Bucketing a time series in SQL

The API used to answer "what is the p75 over this window?" with one window-function statement (chapter 04).
A series is the same question asked once per bucket.

`src/db/queries/series.ts` does it in three steps inside one statement.
First it joins metric events to pageviews and sessions under the usual site, path, time window, and dimension filters, and computes `(pv.started_at / B) * B` where `B` is the bucket width in milliseconds.
`started_at` is an integer column and `B` is spliced in as an integer literal, so SQLite divides with integer division and the expression floors every timestamp down to the start of its bucket.
Second, the same window functions as before rank every value within its (metric, bucket) partition and count the partition.
Third, the outer `GROUP BY name, bucket_start` picks the value at rank `ceil(0.75 * n)`, the identical nearest-rank p75 the cards use.

Buckets with no samples never appear in the rows; the resolver guarantees all five metrics appear, with an empty point list where there is nothing.
Bucket boundaries are UTC epoch multiples, so a DAY bucket is a UTC day, which matches the UTC timestamps the dashboard shows everywhere.

The bucket is an argument, not a fixed size, because the right width depends on the range: an hour for "last 24 hours" (24 points), six hours for "last 7 days" (28 points), a day beyond that.
`toSeriesBucket` in `src/dashboard/filters.ts` is the one place that mapping lives.
The sample count travels with every point for the same reason chapter 12 insisted on a sample floor: a bucket's p75 over four samples is a guess, and the chart's description says how many samples are behind the line.

## Filters in the URL, or in state

The overview keeps its filters in React state.
The Server Component renders the default view into the HTML, the client takes over, and a filter change is one GraphQL request with no navigation; the URL stays `/`.

The page detail does the opposite.
Its filters are search params (`?range=30d&device=MOBILE`), the filter bar pushes a new URL, and the Server Component renders the new answer.
The reason is what the page is for: a drill-down someone pastes into a message or links from an incident.
A view that lives in client state cannot be shared; a URL can.

The cost is two patterns for one control.
`FilterBar` is the same controlled component on both routes; what differs is the `onChange` handler: the overview sets state, the page detail wraps the same bar in `PageFilters`, which calls `router.push` with `pageDetailHref({ siteId, path, filters })`.
The URL is parsed back into `DashboardFilters` by `src/dashboard/pageDetail.ts`, which treats the search params as untrusted input: an unknown device value or a garbage range falls back to the default rather than reaching the query.

The route itself is an optional catch-all segment, `[[...path]]`.
A page's path contains slashes, so `/blog/why-field-data-beats-lab-scores` would be ambiguous as a single dynamic segment; as a catch-all it arrives as an array of segments and `pathFromSegments` joins them back.
The root path `/` is the route with no segments at all, which is why the catch-all is optional.

Two things about those segments were only found by review and measurement.
First, this Next.js hands the page component its params percent-encoded (a space arrives as `%20`) but hands `generateMetadata` the same params decoded; the helpers in `routes.ts` take a `ParamEncoding` so each caller says which it has, and `routes.test.ts` round-trips nine shapes of path (`/`, a space, `café`, `100%`, a trailing slash) through both.
Second, a path the segment form cannot carry, such as `/blog/` with its trailing slash, travels as `?path=/blog/` instead, and the route prefers that param when it is present.
The README Decisions entry has the detail.

The sessions on a page are found with an `EXISTS` probe per session: "does this session have a pageview on this path?".
On the stress seed that probe took 14 ms for the busiest path because the only usable index was on `path` alone, so every probe scanned thousands of rows for the session id.
Migration 0003 widens the sessions index to `(session_id, path)`, a covering index for exactly that probe, and the same call takes 0.15 ms; `sessions.test.ts` asserts the query plan uses it, so the index cannot quietly disappear.

## What the bundle budget saw

`npm run build && npm run check:bundle` after the milestone:

| Route | Before M16 | After M16 |
| ----- | ---------- | --------- |
| `/` | 736,876 B (M14), budget ceiling 758,814 B on the M8 baseline | 764,000 B, 0.68% over the ceiling |
| `/incidents/[id]` | 730,404 B (M14) | 752,740 B |
| `/sites/[siteId]/pages/[[...path]]` | n/a | 704,154 B |

The overview tripped its budget by 5,186 bytes.
The growth is the trend chart, the sparklines, the metric switcher, and the attention strip, plus the page detail's GraphQL document riding in the shared codegen map (the same effect M14 noted).
Nothing server-only leaked: Zod is imported only by `pageDetail.ts`, which runs on the server, and `next/link` was already in the bundle for the incidents table.

The baseline was moved to the measured number with a README Decisions entry.
A budget exists to catch accidental growth; this growth is the route's features.
The cost is that the next 10% of headroom starts from a higher floor, so the parked document-map split is the first thing to reach for when the route grows again.
Both other routes were re-baselined in the same commit so that every number in `bundle-budget.json` is from one build.

## Why every new file exists

### Data and schema

- `src/vitals/series.ts`: the bucket vocabulary (`hour`, `six-hours`, `day`) and each one's width in milliseconds.
  It lives beside `metrics.ts` so the GraphQL enum, the SQL, and the dashboard's range-to-bucket mapping all derive from one list; without it three files would each spell the buckets.
- `src/db/queries/series.ts`: the one statement that returns p75 and sample count per (metric, bucket) for a site or one path.
  The bucket width is spliced in as an integer literal on purpose, so SQLite's integer division floors each timestamp to its bucket; a bound parameter could arrive as a REAL and make the division exact.
- `src/graphql/types/series.ts`: the `SeriesPoint` and `MetricSeries` object types and the resolver that groups rows into all five metrics in display order, empty where there is nothing.
- `src/graphql/types/page-breakdown.ts`: `PageBreakdown` and `PageBreakdownRow`, each row's `metrics` being the existing `MetricSummary`, so the breakdown tables format with the same code as the cards.
- `src/graphql/page-detail.test.ts`: the behaviour table for the new fields: two pageviews 30 hours apart land in different DAY buckets, an unknown path is null, a page's sessions are only the sessions that visited it, a dimension with no samples is absent, and a statement-count pin (8 for the whole page detail query).
- Changed: `src/db/queries/pages.ts` gained `getPageForSite`, `sessions.ts` an optional `path` (an `EXISTS` so a session with several visits is never duplicated), `breakdown.ts` a `loadPageBreakdown`, and `metrics.ts` exports its summary column list so the breakdown produces the exact `MetricSummaryRow` shape.

### Shared UI

- `src/app/globals.css`: the token set; see "Design tokens, and why a scale".
- `src/dashboard/routes.ts`: every URL the dashboard links to.
  A page's path becomes URL segments, a site id is encoded once, and only the non-default filters travel as search params; without it the pages table and the route would each encode paths their own way.
- `src/dashboard/components/Sparkline.tsx`: the axis-free line beside a card's number, drawn with the chart's own scale maths.
- `src/dashboard/components/MetricTrend.tsx`: one chart with a tab per metric; the only state is the chosen tab.
- `src/dashboard/components/Toolbar.tsx`: the sticky bar every route shares, with a brand slot and a controls slot, so the overview and the page detail line up.
- `src/dashboard/components/StatusPill.tsx`: the one pill for every status, rating, and file action, replacing three copies of the same CSS.
- `src/dashboard/components/Timestamp.tsx`: the `<time>` element with its ISO `dateTime`, previously duplicated in two components.
- `src/dashboard/components/Callout.tsx`: the "waiting for you" and "approved" notices on the decision card, with an icon and a tone.
- `src/dashboard/components/BackToOverview.tsx`: the breadcrumb link, shared by the incident page, its not-found page, and the page detail.
- `src/dashboard/components/shared.module.css`: the rulesets more than one component composes (`visuallyHidden`, `eyebrow`, `inlineLink`, `panel`, `well`, `column`, `cards`, the three button classes), using CSS Modules' `composes: x from "./shared.module.css"`.
  One concept, one ruleset; the two breakpoints the whole dashboard uses (640 and 900 px) are documented here.
- `src/dashboard/components/table.module.css`: the shell the four data tables compose: scroll region, cell padding, the sunken uppercase header row, numeric cells, the empty row.
- `src/dashboard/components/form.module.css`: field, label, textarea, hint, error, and button-row rules the decision form and the fix editor's form compose.
- `src/dashboard/components/Icon.tsx`: the inline-SVG shell (current colour, round 1.5 px strokes, hidden from assistive technology); callers pass only paths.
- `src/dashboard/components/RatingDot.tsx`: the one rating dot, drawn five different ways before this file existed, with an optional visually hidden rating word so colour is never the only carrier.
- `src/dashboard/components/FactList.tsx`: label-over-value facts under a title, shared by the incident header and the page detail header.
- `src/dashboard/components/NotFoundView.tsx`: the one not-found page both detail routes render, with the toolbar, the breadcrumb, and an action back to the overview.
- `src/dashboard/components/SectionHeader.tsx`, `EmptyState.tsx`, `Brand.tsx` (with `BrandLink`), `SelectField.tsx`: see "Overview" below; after the convergence pass every route uses them.

### The convergence pass

Three agents built the three routes in parallel against the same tokens, and a review of the result found the drift that parallel work produces: a status pill written four times, a rating dot five ways, the visually hidden ruleset in eight stylesheets, breakpoints at 480, 560, 639, 640, 880, and 900.
None of it was wrong on its own; together it was a second design system growing inside the first.
The fix was a pass whose only goal was convergence: one component or one ruleset per concept, with no change to any name, role, label, or copy a test depends on.
That is why `shared.module.css`, `table.module.css`, `form.module.css`, `RatingDot`, `FactList`, `Icon`, and `NotFoundView` exist, and why the chapter lists them separately: they are the shape the three routes converged on, not the shape any one of them started with.

### Incident page

- `src/dashboard/components/VitalsComparison.tsx`: the before/after evidence as two figures, a delta chip, and threshold bars.
  Each bar is an SVG with every x and width a percentage, so it fits any container without measuring; the track is painted in the metric's three web.dev bands and the value bar sits on top in its rating colour, so a long bar still shows where the thresholds are.
  The figures are a `<dl>` and the bars carry one `role="img"` sentence, so a screen reader hears each number once.
- `src/dashboard/components/StepIcon.tsx`: a 16 px inline SVG per step role on the timeline rail, decorative and hidden from assistive technology because the role label beside it carries the meaning.
- `src/app/incidents/[id]/not-found.tsx`: the "No such incident" page that `notFound()` in this segment renders.
- Changed: `IncidentDetail` (header band, timeline with the rail drawn per step so it ends at the last marker), `FixReview` (a card; a "Files in this change" list of fragment links when there is more than one file, with `+N -N` counts from the new `countDiffLines` in `src/dashboard/fix-review.ts`), `DiffView.module.css` (sunken gutter, soft tints, and `position: relative` on the scroller because a visually hidden `<th>` positioned absolutely was widening the page to 491 px at 390), `IncidentActions.module.css`, `CodeEditor` (theme only).
  The file list is a list of links rather than tabs because the no-JS e2e and the first paint need every diff in the HTML; tabs would hide content or need client state.

### Overview

- `src/dashboard/attention.ts`: the pure summary behind the attention strip.
  Every non-terminal incident counts as open, failing and degraded checks are counted separately, and `attentionItems` spells the wording and the anchor each item links to; four tests pin the counts and the singular and plural forms.
- `src/dashboard/overviewModel.ts`: the dashboard query result reshaped into component props (cards with their sparkline points, series, pages, incidents, checks, sessions).
  Pulled out of `DashboardView` so the view only lays things out.
- `src/dashboard/chartScale.test.ts` and `buildFittedTicks` in `chartScale.ts`: a fixed four-tick axis doubled the chart's height for a 7.6 s maximum (stepping by 5 s up to 15 s); the fitted version tries four to six ticks and keeps the tightest top.
- `src/dashboard/components/AttentionStrip.tsx`: the strip under the toolbar.
  Each item is a plain link to `#incidents` or `#health`; it is deliberately not a live region, because the overview's one `role="status"` is the loading pill and the e2e finds it by that role.
- `src/dashboard/components/Brand.tsx`: the h1 and tagline, replacing `DashboardHeader`.
- `src/dashboard/components/SelectField.tsx`: one labelled native select with a chevron drawn in CSS so it matches dark mode, used by the site picker and the three filters.
- `src/dashboard/components/SectionHeader.tsx`: an h2 with an optional count and description, so "Incidents · 2" and "Pages · 8" are built once.
- `src/dashboard/components/EmptyState.tsx`: icon, title, one sentence; the no-sites, no-checks, and no-self-measurement states all use it.
- Changed: `Toolbar` gained a `secondRow` for the filters, which scrolls sideways on a phone so the sticky bar is exactly two rows at 390 px; `TimeSeriesChart` lost its own frame and is drawn twice, once at 960 wide and once in a narrow viewBox, with CSS showing one below 640 px, because SVG text scales with width and a resize observer would have shifted the page after first paint; `MetricCard` takes `points`; `PagesTable` takes `siteId` and links each path; the incidents and sessions tables got the token treatment and a sunken header row.
  Three different tables each needed `position: relative` on their scroll container: the visually hidden text inside them is absolutely positioned, and without a positioned ancestor it escaped the overflow clip and widened the page past the viewport on a phone.

### Page detail

- `src/app/sites/[siteId]/pages/[[...path]]/page.tsx`: the route.
  It awaits `params` and `searchParams` (both Promises in this Next.js), rebuilds the path from the segments, parses the filters, runs `PAGE_DETAIL` in-process, and answers an unknown site with `notFound()` and a known site with no traffic under the filter with an empty state, because a narrower filter is not a 404.
  Loading lives in a function outside the component because the lint rule for render purity forbids reading the clock in render, the same reason the overview has `loadOverview`.
- `src/app/sites/[siteId]/pages/[[...path]]/not-found.tsx`: the "No such site" page.
- `src/dashboard/pageDetail.ts`: the pure helpers.
  `parsePageDetailSearchParams` runs the raw params through a Zod object whose every field has its own `.catch(default)`, so one bad value falls back alone and the valid values beside it survive; `toPageDetail` turns the wire shape into what the components take.
  The breakdown's samples column is the max of a row's per-metric counts, not the sum: a pageview reports up to five metrics, so a sum would count one visit five times.
- `src/dashboard/pageDetail.test.ts`: a full URL parses, garbage and repeated keys fall back, an unknown device is ignored while the valid range beside it is kept, and what `toFilterSearchParams` writes parses back unchanged, which is the contract between the filter bar and the route.
- `src/dashboard/components/PageDetailView.tsx`: the Server Component that composes the toolbar, header, cards, trend, breakdowns, and sessions, or the empty state.
- `src/dashboard/components/PageDetailHeader.tsx`: breadcrumb, the "Page on <site>" eyebrow, the path as a monospace h1, and the fact row.
- `src/dashboard/components/PageDetailEmptyState.tsx`: two forms: the filters narrowed to nothing (offers "Show all time") or the path was never recorded (links back to the overview).
- `src/dashboard/components/BreakdownTable.tsx`: one table per dimension with a rating dot and visually hidden rating text per cell, an empty line when a dimension has no samples, and its own scroll region.
  The tables are stacked rather than side by side because at 1440 px two columns gave each table less than its seven columns need.
- `src/dashboard/components/PageFilters.tsx`: the client wrapper around `FilterBar` that turns a change into `router.push` of the new URL inside a transition, with an "Updating…" status while the server answers.
  `push`, not `replace`, so Back undoes a filter change instead of leaving the page.
- `e2e/page-detail.spec.ts`: the seeded `/pricing` page renders with JavaScript disabled, a range change lands in the URL, axe finds nothing serious, and two awkward paths (`/e2e/a b/100%`, `/e2e/trailing/`) ingested through the collect endpoint reach their own detail page through the table's link with the right title.
- `src/dashboard/routes.test.ts`: nine shapes of path round-trip through `pageDetailHref` and back under both param encodings.
- `src/db/queries/sessions.test.ts`: the per-path sessions query's plan uses the covering index; see "Filters in the URL, or in state".
- `drizzle/0003_pageviews_session_path_index.sql`: the `(session_id, path)` index behind `Page.sessions`.

## How to see it working

```bash
npm run db:seed && npm run incidents:detect
npm run dev
```

Open `http://localhost:3000`.
The strip under the toolbar says two incidents are open and one check is failing; the five cards each carry a sparkline, and the trend card below them draws LCP with the good and poor bands behind the line.
Press the CLS tab, then use the arrow keys to move between metrics: one Tab stop, five metrics.
Switch your system to dark mode and watch every surface and rating colour follow with no component change.

Click `/pricing` in the pages table.
The URL becomes `/sites/demo/pages/pricing`; change the time range to "All time" and the URL gains `?range=all` while the page re-renders on the server.
Paste that URL into a new private window: the same view opens, which the overview's client-state filters cannot do.

Open the "LCP on /pricing" incident.
The evidence is two figures and two bars; the ticks under the bars are the web.dev thresholds, so the current window's bar visibly crosses into the poor band.
Disable JavaScript in DevTools and reload any of the three routes: everything above is still there, because each is a Server Component tree.

```bash
npm run storybook      # every component in its empty, loading, and edge states (dark mode: switch the OS, the tokens follow)
npm run build && npm run check:bundle
```

## Self-check

1. A component needs a gap slightly larger than `--space-4` and slightly smaller than `--space-6`. What should happen?
2. Why does the sparkline use its own min and max as the vertical domain while the chart starts at zero?
3. The series statement computes `(started_at / 21600000) * 21600000`. Why is the result the start of a six-hour bucket and not the timestamp itself?
4. Why does the page detail put filters in the URL when the overview does not?
5. What does the "optional" in optional catch-all buy, and what would break without it?

<details>
<summary>Answers</summary>

1. Pick one of the two. A value between them is a new size that relates to nothing; if it keeps happening, the scale is wrong and gains a step in `globals.css`, not a one-off in a component.
2. A sparkline shows shape, so it should use its whole box for whatever range the data has; the chart shows rating, so zero and the thresholds must sit at fixed positions.
3. Both operands are integers, so SQLite performs integer division and discards the remainder; multiplying back gives the largest multiple of the bucket width at or below the timestamp.
4. The page detail is a drill-down people share and link to from an incident, and a link can only carry what is in the URL; the overview is the landing page, where one request per filter change and a stable `/` matter more.
5. Zero segments is a valid match, which is how the root path `/` gets a page detail at `/sites/<id>/pages`. Without it that URL would be a 404 and the most visited path on many sites would have no drill-down.

</details>
