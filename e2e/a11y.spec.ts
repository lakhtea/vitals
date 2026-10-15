// Page-level axe gate for the overview (WCAG 2.1 A/AA). Fails CI on serious and
// critical violations only; the rest are printed for review, per
// TESTING_RULES.md and docs/learning/09-accessibility.md. Storybook checks each
// component alone; this run sees the composed page with real seeded data.
import { expect, test } from "@playwright/test";
import { expectNoGatedViolations } from "./axe";
import { distinctSessionDevices, openSeededOverview } from "./overview";

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
