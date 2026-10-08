import { expect, test, type Page } from "@playwright/test";
import { openSeededOverview } from "./overview";

test("home page lists seeded pages with their traffic counts", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Vitals" })).toBeVisible();

  // Seeded synthetic traffic flows: SQLite -> Drizzle -> Pothos -> Yoga -> Apollo Client -> table.
  // Scoped to the pages table: the sessions table lists paths too.
  const pagesTable = page.getByRole("table", { name: /Pages with p75/ });
  await expect(pagesTable.getByRole("rowheader", { name: "/pricing", exact: true })).toBeVisible();
  await expect(pagesTable.getByRole("rowheader", { name: "/", exact: true })).toBeVisible();
});

// The seed orders sites by name: the demo site first, then the self-measured
// dashboard site, which has no seeded traffic and so renders empty tables.
const OTHER_SITE_OPTION_INDEX = 1;

/** Holds every GraphQL response until `release` is called, so a loading render can be observed. */
const holdGraphqlResponses = async (page: Page): Promise<{ release: () => void }> => {
  let release = (): void => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/graphql", async (route) => {
    await held;
    await route.continue();
  });
  return { release };
};

test("while a changed filter loads, the tables on screen stay, not an older site's result", async ({ page }) => {
  const { pagesTable } = await openSeededOverview(page);
  const pricingRow = pagesTable.getByRole("rowheader", { name: "/pricing", exact: true });
  const siteSelect = page.getByLabel("Site", { exact: true });

  // Visit the other site, then come back to the server-rendered view.
  await siteSelect.selectOption({ index: OTHER_SITE_OPTION_INDEX });
  await expect(pricingRow).toBeHidden();
  await siteSelect.selectOption({ index: 0 });
  await expect(pricingRow).toBeVisible();

  const { release } = await holdGraphqlResponses(page);
  await page.getByLabel("Time range").selectOption("all");
  await expect(page.getByRole("status")).toHaveText("Updating…");
  // The demo site's rows must still be there, not the empty tables of the site visited before.
  await expect(pricingRow).toBeVisible();

  release();
  await expect(page.getByRole("status")).not.toHaveText("Updating…");
});

test("a query that fails is reported in the status line", async ({ page }) => {
  await openSeededOverview(page);
  await page.route("**/api/graphql", (route) => route.abort("connectionrefused"));

  await page.getByLabel("Time range").selectOption("all");
  await expect(page.getByRole("status")).toHaveText(/^Could not update: /);
});
