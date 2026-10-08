import { expect, test } from "@playwright/test";

test("home page lists seeded pages with their traffic counts", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Vitals" })).toBeVisible();

  // Seeded synthetic traffic flows: SQLite -> Drizzle -> Pothos -> Yoga -> Apollo Client -> table.
  await expect(page.getByRole("cell", { name: "/pricing" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "/", exact: true })).toBeVisible();
});
