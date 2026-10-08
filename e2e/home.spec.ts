import { expect, test } from "@playwright/test";

test("home page lists seeded applications from the GraphQL API", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Pipeline" })).toBeVisible();

  // Seeded demo data flows: SQLite → Drizzle → Pothos schema → Yoga → Apollo Client → table.
  await expect(page.getByRole("cell", { name: "Netflix" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Figma" })).toBeVisible();
});
