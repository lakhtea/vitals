// Shared steps for e2e specs that drive the dashboard overview: open it with
// seeded data on screen, find its two tables by role, and read which device
// classes the sessions table currently shows (the visible proof that a filter
// reached the data, independent of the status line's wording).
import { expect, type Locator, type Page } from "@playwright/test";

export interface OverviewTables {
  pagesTable: Locator;
  sessionsTable: Locator;
}

export const openSeededOverview = async (page: Page): Promise<OverviewTables> => {
  await page.goto("/");
  const pagesTable = page.getByRole("table", { name: /Pages with p75/ });
  // Seeded traffic always includes /pricing; once it is on screen the first query has landed.
  await expect(pagesTable.getByRole("rowheader", { name: "/pricing", exact: true })).toBeVisible();
  // The sessions table has no caption yet; the Browser column exists in no other table.
  const sessionsTable = page
    .getByRole("table")
    .filter({ has: page.getByRole("columnheader", { name: "Browser", exact: true }) });
  return { pagesTable, sessionsTable };
};

// "Unknown" is left out on purpose: it is also a connection label, so it would
// not identify the Device column.
const DEVICE_CELL_TEXT = /^(Desktop|Mobile|Tablet)$/;

/** Distinct device labels in the sessions table, sorted, e.g. ["Desktop", "Mobile", "Tablet"]. */
export const distinctSessionDevices = async (sessionsTable: Locator): Promise<string[]> => {
  const labels = await sessionsTable.getByRole("cell", { name: DEVICE_CELL_TEXT }).allTextContents();
  return [...new Set(labels)].sort();
};
