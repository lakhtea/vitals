# 06 - Dashboard UI and Storybook

> Milestone 6 turned the placeholder table into a dashboard built from five hand-rolled components, each developed and tested in Storybook before it touched the page.

## What was built

- Five components in `src/dashboard/components/`: `MetricCard`, `PagesTable`, `SessionsTable`, `FilterBar`, `TimeSeriesChart`, styled with CSS Modules and a small token set in `globals.css`.
- A story file per component covering the states that break layouts: empty, all-poor ratings, very long paths, huge values, missing data.
- Two interaction tests written as Storybook play functions: changing a filter fires `onChange` with the right value, and clicking a column header re-sorts the pages table both ways.
- The a11y addon with violations treated as failures, so every story is also an accessibility test.
- Storybook's Vitest addon wired as a second Vitest project, so `npm run test:storybook` runs every story in real Chromium, locally and in CI.
- The dashboard page composed from those components, with one `TrafficFilter` variable driving the metric cards, the pages table, and the sessions table together.

## Why these five components

A component boundary is worth drawing where one of three things is true: the piece answers a distinct user question, it has states worth testing alone, or it will be reused.

- `MetricCard` answers "is this metric good right now?" for one metric.
  It owns the formatting rules (seconds vs milliseconds, CLS to two decimals) and the rating colour, so nothing else in the app needs to know a threshold.
- `PagesTable` answers "which pages are slow?".
  Sorting is the behaviour that matters, so the comparator is a pure function with the table as its thin shell.
- `SessionsTable` answers "what did one visitor experience?".
  It is deliberately static (no hooks) so it can later render on the server.
- `FilterBar` answers "for whom, and when?".
  It is a controlled component: it owns no state, it reports intent upward, and the page decides what to do with it.
  That is what makes it testable in isolation and reusable above any data.
- `TimeSeriesChart` answers "is it getting better?".
  Hand-rolled SVG with the scaling maths in a pure module, because a chart library would hide the one piece of this work worth showing.

What was not split out: table rows, rating pills, header buttons.
They have no states of their own and no second consumer; splitting them would be structure without meaning.

## What a story is

A story is one named, rendered state of one component: props in, pixels out, no app around it.
Storybook collects stories into a catalogue you can click through, and the Vitest addon turns the same stories into tests.

Stories are where edge states live.
The real seed never produces a 48-second LCP, an empty sessions table, or a path two hundred characters long, so without stories those renderings would be seen for the first time in production.
Writing the story first forces the question "what should this look like?" before the component exists, which is the design review most components never get.

## What a play function is

A play function is a script attached to a story that runs after it renders: find an element, interact with it, assert.
It uses the same Testing Library queries and `userEvent` as a component test, but it runs inside the real story, in a real browser, with the real CSS.

The two here protect the two behaviours that would silently break the dashboard:

- `FilterBar`: select "Mobile" and assert `onChange` was called with `deviceClass: "MOBILE"`.
  If a `<select>` loses its `onChange`, or the enum value drifts, the dashboard filters nothing and shows no error.
- `PagesTable`: click the LCP header and assert the slowest page is first; click again and assert the fastest is.
  Sorting by the wrong column or direction would quietly point the user at the wrong page.

## Interaction tests versus end-to-end tests

Both drive a browser; they answer different questions.

| | Play function | Playwright e2e |
| --- | --- | --- |
| Boots | one component with fake props | the whole app, server, database |
| Proves | the component behaves, in isolation, in every state you can describe | the system works end to end for one real path |
| Speed | milliseconds per story | seconds per test |
| Breaks when | the component's behaviour changes | anything in the chain changes |
| Count here | a story per state, two with interactions | three specs total |

The rule from TESTING_RULES.md applies: do not prove the same thing at both levels.
Sorting is proven in Storybook and not again in Playwright; "seeded data reaches the page" is proven in Playwright and not in Storybook.

## What the a11y addon checks, and what it cannot

The addon runs axe-core against each rendered story and fails the test on any violation: missing labels, header cells without scope, insufficient colour contrast, empty buttons, images without text alternatives.
That is the mechanical half of accessibility, and catching it per story means it is caught before the component is ever composed into a page.

axe cannot tell you whether the tab order makes sense, whether a chart's text alternative is actually useful, or whether a keyboard user can complete a task.
Those are M9's job, with real keyboard-path tests.

## Why Storybook runs inside Vitest

Storybook 9 replaced the standalone test runner with a Vitest plugin.
Each story becomes a test case; the browser-mode provider launches Chromium through Playwright, renders the story, runs its play function, then runs axe.
It lives in `vitest.config.mts` as a second project named `storybook`, separate from `unit`, so the fast unit loop never starts a browser and CI reuses the Chromium it already installs for Playwright.

## How the page composes them

`src/app/page.tsx` holds exactly two pieces of state: which site, and the current `DashboardFilters`.
`toTrafficFilter` turns the filters into the GraphQL `TrafficFilter` variable, and one typed document fetches the site's metrics, pages (with their metrics), and sessions in a single request.
The components receive plain props; none of them knows GraphQL exists.
That boundary is what M7 relies on when the first paint moves to the server.

## Why every new file exists

- `src/dashboard/components/*.tsx` with a `.module.css` beside each: the five components.
  CSS Modules scope class names per file, so `.table` in two components cannot collide, and the tokens they share live in `src/app/globals.css`.
- `src/dashboard/components/*.stories.tsx`: one story file per component, CSF3, with `fn()` spies for callbacks and the two play functions.
- `src/dashboard/sortPages.ts`: the pure comparator and the column definitions behind `PagesTable`; numeric columns open descending (slowest first), path opens ascending, and pages missing a metric sink to the bottom.
- `src/dashboard/filters.ts`: the `DashboardFilters` shape, the option lists, and `toTrafficFilter`, which turns a time-range key into the GraphQL `TrafficFilter` variable.
- `src/dashboard/labels.ts` and `src/dashboard/dates.ts`: display strings for the enum values and `Intl`-based date formatting, kept out of the components so they can be reused by the sessions view and by stories.
- `src/dashboard/chartScale.ts`: linear scales, the line path builder, nice ticks, and the series summary that feeds the chart's `<desc>`.
- `src/dashboard/adapters.ts`: maps GraphQL enum values (`NEEDS_IMPROVEMENT`) to the domain unions the components take (`needs-improvement`), so components never import GraphQL types.
- `src/vitals/format.ts`: metric value formatting (seconds vs milliseconds, CLS to two decimals), long labels, and the "good ≤ 2.5 s" hint; the vocabulary of how a metric is shown lives next to the vocabulary of what it is.
- `src/app/page.tsx` and `page.module.css`: the composed overview described above (`page.module.css` has since been replaced by `src/dashboard/components/DashboardView.module.css`).
- `.storybook/main.ts` and `preview.ts`: framework, story glob, addons; global CSS and `a11y.test = "error"`.
- `vitest.config.mts`: now two projects, `unit` and `storybook`; `npm run test` runs the first, `npm run test:storybook` the second.
- `codegen.ts`: maps the `DateTime` scalar to `string` so generated types match the wire format; the default would have been `unknown`.
- `.github/workflows/ci.yml`: runs `test:storybook` in the browser job before the e2e suite.

Two things this milestone fixed that were already wrong: the create-next-app `overflow-x: hidden` on `body` quietly made the whole page a scroll container without keyboard access (axe caught it on the first story run), and the e2e specs matched path cells anywhere on the page, which broke the moment a second table listed paths.

## How to see it working

```bash
npm run storybook          # http://localhost:6006
npm run test:storybook     # every story + play function + axe, headless Chromium
npm run dev                # the composed dashboard at http://localhost:3000
```

In Storybook: open `PagesTable / Default`, switch to the Interactions panel, and step through the play function.
Open the Accessibility panel on any story and read the passing rules; then, in the browser devtools, delete a `<label>` and watch the panel turn red.
