import { expect, test } from "@playwright/test";

// With JavaScript off nothing hydrates and nothing fetches: whatever this test
// can see was in the HTML the server sent. It is the proof behind the claim
// that the first paint is rendered on the server.
test.use({ javaScriptEnabled: false });

test("the overview arrives server-rendered with seeded aggregates", async ({ page }) => {
  await page.goto("/");

  const pagesTable = page.getByRole("table", { name: /Pages with p75/ });
  await expect(pagesTable.getByRole("rowheader", { name: "/pricing", exact: true })).toBeVisible();

  const cards = page.getByRole("region", { name: "Site-wide p75 by metric" }).getByRole("article");
  await expect(cards).toHaveCount(5);
  await expect(cards.filter({ hasNotText: "No data" }).first()).toBeVisible();

  // The self-measurement panel is server-rendered too; the seed gives its site no traffic, so it is the empty state.
  const selfPanel = page.getByRole("complementary");
  await expect(selfPanel.getByRole("heading", { level: 2, name: "This site, measured by itself" })).toBeVisible();
  await expect(selfPanel.getByText(/^No sessions recorded yet/)).toBeVisible();
});
