// Page-level axe gate for the overview (WCAG 2.1 A/AA). Fails CI on serious and
// critical violations only; the rest are printed for review, per
// TESTING_RULES.md and docs/learning/09-accessibility.md. Storybook checks each
// component alone; this run sees the composed page with real seeded data.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { distinctSessionDevices, openSeededOverview } from "./overview";

type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
type AxeViolation = AxeResults["violations"][number];

const WCAG_21_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const GATED_IMPACTS: ReadonlySet<string> = new Set(["serious", "critical"]);

const describeViolation = (violation: AxeViolation): string => {
  const targets = violation.nodes.map((node) => node.target.join(" ")).join(", ");
  return `${violation.impact ?? "unknown"} ${violation.id}: ${violation.help} at ${targets} (${violation.helpUrl})`;
};

const isGated = (violation: AxeViolation): boolean => GATED_IMPACTS.has(violation.impact ?? "");

const expectNoGatedViolations = async ({ page, state }: { page: Page; state: string }): Promise<void> => {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_21_AA_TAGS)
    // Next's dev-only tools indicator renders inside <nextjs-portal>; it is not part of the dashboard.
    .exclude("nextjs-portal")
    .analyze();

  const gated = results.violations.filter(isGated);
  const advisory = results.violations.filter((violation) => !isGated(violation));

  for (const violation of advisory) {
    const line = `axe advisory [${state}] ${describeViolation(violation)}`;
    console.info(line);
    test.info().annotations.push({ type: "axe-advisory", description: line });
  }

  expect(gated.map(describeViolation), `serious/critical axe violations [${state}]`).toEqual([]);
};

test("overview with default filters has no serious or critical axe violations", async ({ page }) => {
  await openSeededOverview(page);

  await expectNoGatedViolations({ page, state: "default filters" });
});

test("overview filtered to Mobile and sorted by LCP has no serious or critical axe violations", async ({ page }) => {
  const { pagesTable, sessionsTable } = await openSeededOverview(page);

  await page.getByLabel("Device").selectOption({ label: "Mobile" });
  await pagesTable.getByRole("button", { name: "LCP", exact: true }).click();

  await expect(pagesTable.getByRole("columnheader", { name: "LCP", exact: true })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  // The filtered query lands asynchronously; axe must see the re-rendered rows, not the previous ones.
  await expect.poll(() => distinctSessionDevices(sessionsTable)).toEqual(["Mobile"]);

  await expectNoGatedViolations({ page, state: "Device = Mobile, sorted by LCP" });
});
