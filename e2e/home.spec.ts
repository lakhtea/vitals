import { expect, test } from "@playwright/test";

test("home page lists seeded pages with their traffic counts", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Vitals" })).toBeVisible();

  // Seeded synthetic traffic flows: SQLite -> Drizzle -> Pothos -> Yoga -> Apollo Client -> table.
  // Scoped to the pages table: the sessions table lists paths too.
  const pagesTable = page.getByRole("table", { name: /Pages with p75/ });
  await expect(pagesTable.getByRole("rowheader", { name: "/pricing", exact: true })).toBeVisible();
  await expect(pagesTable.getByRole("rowheader", { name: "/", exact: true })).toBeVisible();
});
