# 09 - Accessibility

> Milestone 9 makes the accessibility claim testable: axe in Playwright, a full keyboard path, and non-visual equivalents for the chart.
> Concept sections first; the file list and the exact e2e specs are added when they land.

## What axe catches, and what it cannot

axe-core is a rules engine that inspects a rendered DOM and reports violations of the WCAG success criteria that can be checked mechanically: form controls without labels, images without alternatives, table headers without scope, insufficient colour contrast, duplicate ids, ARIA attributes used on the wrong roles, focusable content hidden from assistive technology.
Run against a real page in Playwright (`@axe-core/playwright`), it checks the composed dashboard with real data, where component-level checks in Storybook could not see cross-component problems like two regions with the same label.

What axe cannot tell you is whether the page is usable.
It cannot know that the tab order jumps from the filters to the footer and back, that a live region announces too often, that a chart's `aria-label` says "chart" and nothing more, or that a keyboard user cannot reach the thing a mouse user clicks.
Those failures are the common ones, and they need a human or a scripted path that behaves like one.

The policy here follows TESTING_RULES.md: axe fails CI on serious and critical violations only.
Minor and moderate findings are reviewed, not gated, because a gate that blocks on "best practice" warnings is a gate people learn to silence.

## The keyboard path, and why it is a test

A keyboard path is a user task completed with no pointer: Tab, Shift+Tab, arrow keys, Enter, Space, Escape.
The dashboard's path is: reach the time-range filter, change it, reach the device filter, change it, reach the pages table, sort it by LCP, reach the first session.

Scripting it in Playwright (`page.keyboard.press("Tab")`, then asserting what has focus and what changed) proves three things at once: every control is reachable in a sensible order, every control is operable without a mouse, and focus is visible, because the test asserts on `:focus-visible` styles being applied.
It is written as one test rather than one per control because the order and continuity between controls is the thing that breaks.

## Non-visual equivalents for the chart

An SVG line chart is a picture.
A screen reader user gets, at best, its accessible name.
Two things make it an honest equivalent:

- The `<svg>` has `role="img"` and is labelled by a `<title>` and described by a `<desc>` that states the metric, the range, the minimum, the maximum, and the latest value: the sentence a colleague would say if you asked them to read the chart aloud.
- A visually hidden `<table>` next to it lists every point, so the data is there for anyone who wants it, including find-in-page and copy-paste.

The hidden table uses the clip-rect pattern, not `display: none`, because `display: none` removes content from the accessibility tree as well as the screen.

## Visible focus

Every interactive element has a `:focus-visible` outline using the foreground colour with a two-pixel offset.
`:focus-visible` rather than `:focus` so mouse clicks do not paint rings but keyboard focus always does.
The tokens were chosen to clear 3:1 against both the light and dark surfaces, which the Storybook a11y run checks per component and the Playwright axe run checks per page.

## Self-check

1. Why run axe both per story in Storybook and per page in Playwright?
2. Why does the keyboard test live in one spec rather than one per control?
3. Why is the chart's data table hidden with a clip pattern instead of `display: none`?
4. Why gate CI on serious and critical only?

<details>
<summary>Answers</summary>

1. Stories catch problems inside a component early and in every state; the page run catches cross-component problems (duplicate landmarks or labels, contrast against the real background) and runs against real data.
2. The failure mode is the path breaking between controls (order, focus loss after a re-render), which only a continuous script observes.
3. `display: none` removes the table from the accessibility tree; the clip pattern keeps it available to assistive technology while hiding it visually.
4. A gate that fails on advisory findings gets ignored or disabled; gating on impact keeps the signal credible while the rest is reviewed.

</details>
