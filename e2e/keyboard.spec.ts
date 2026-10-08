// The dashboard's keyboard path as one continuous script with no pointer:
// reach and change two filters, sort the pages table, move on. One test on
// purpose: what breaks in practice is the continuity between controls (tab
// order, focus lost after a re-render), which only a continuous path observes.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { distinctSessionDevices, openSeededOverview } from "./overview";

// Generous upper bound: the longest hop (Device to the LCP header) is five Tabs today.
const MAX_TABS_BETWEEN_CONTROLS = 12;

const isFocused = (locator: Locator): Promise<boolean> =>
  locator.evaluate((element) => element === document.activeElement);

const tabUntilFocused = async ({ page, target }: { page: Page; target: Locator }): Promise<void> => {
  for (let pressed = 0; pressed < MAX_TABS_BETWEEN_CONTROLS; pressed += 1) {
    await page.keyboard.press("Tab");
    if (await isFocused(target)) {
      return;
    }
  }
  throw new Error(`Pressed Tab ${MAX_TABS_BETWEEN_CONTROLS} times without reaching the target control`);
};

// A focused <select> jumps to the next option starting with a typed letter
// (typeahead) on every platform. ArrowDown is not portable: on macOS Chromium
// it opens the popup instead of changing the value.
const chooseOptionByTypeahead = async ({
  page,
  select,
  optionLabel,
}: {
  page: Page;
  select: Locator;
  optionLabel: string;
}): Promise<void> => {
  await page.keyboard.press(optionLabel.charAt(0).toLowerCase());
  await expect(select.locator("option:checked")).toHaveText(optionLabel);
  await expect(select).toBeFocused();
};

const expectVisibleFocusRing = async (control: Locator): Promise<void> => {
  await expect(control).not.toHaveCSS("outline-style", "none");
  await expect(control).not.toHaveCSS("outline-width", "0px");
};

test("filters, the pages table sort, and the next control are reachable and operable by keyboard alone", async ({
  page,
}) => {
  const { pagesTable, sessionsTable } = await openSeededOverview(page);
  const timeRange = page.getByLabel("Time range");
  const device = page.getByLabel("Device");
  const lcpHeader = pagesTable.getByRole("columnheader", { name: "LCP", exact: true });
  const lcpButton = lcpHeader.getByRole("button");
  const clsButton = pagesTable.getByRole("button", { name: "CLS", exact: true });

  // Filters: reach each select from the top of the document and change it.
  await tabUntilFocused({ page, target: timeRange });
  await expect(timeRange).toBeFocused();
  await chooseOptionByTypeahead({ page, select: timeRange, optionLabel: "Last 30 days" });

  await tabUntilFocused({ page, target: device });
  await expect(device).toBeFocused();
  await chooseOptionByTypeahead({ page, select: device, optionLabel: "Mobile" });
  // The change reached the data, not just the control.
  await expect.poll(() => distinctSessionDevices(sessionsTable)).toEqual(["Mobile"]);

  // Pages table: sort by LCP with Enter, twice, without losing focus or the focus ring.
  await tabUntilFocused({ page, target: lcpButton });
  await expect(lcpButton).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(lcpHeader).toHaveAttribute("aria-sort", "descending");
  await expect(lcpButton).toBeFocused();
  await expectVisibleFocusRing(lcpButton);

  await page.keyboard.press("Enter");
  await expect(lcpHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(lcpButton).toBeFocused();

  // Onward: the next control after LCP is the CLS header. The sessions table has no
  // interactive content yet; when sessions become openable, this is where that lands.
  await page.keyboard.press("Tab");
  await expect(clsButton).toBeFocused();
});
