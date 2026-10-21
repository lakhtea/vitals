// The page detail route against seeded data: the first HTML is complete
// without JavaScript, a filter change becomes a URL the server renders again,
// and the composed page passes the axe gate.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { expectNoGatedViolations } from "./axe";

// The seed's site id and its busiest path (see src/db/seed.ts and e2e/overview.ts).
const PRICING_DETAIL_URL = "/sites/demo/pages/pricing";

const metricCards = (page: Page) => page.getByRole("region", { name: "p75 by metric for this page" }).getByRole("article");

/** One desktop pageview with an LCP on the path, delivered the way the library delivers it. */
const ingestPageview = async ({ request, path }: { request: APIRequestContext; path: string }): Promise<void> => {
  const now = Date.now();
  const suffix = `${now}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await request.post("/api/collect", {
    data: {
      siteId: "demo",
      session: { id: `e2e-session-${suffix}`, startedAt: now - 5_000, deviceClass: "desktop", connectionType: "4g", userAgentFamily: "Chrome" },
      pageview: { id: `e2e-pageview-${suffix}`, path, startedAt: now - 5_000 },
      events: [{ id: `e2e-lcp-${suffix}`, name: "LCP", value: 1850, recordedAt: now - 3_000 }],
    },
  });
  expect(response.status()).toBe(202);
};

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the seeded /pricing page arrives server-rendered with cards and a breakdown", async ({ page }) => {
    await page.goto(PRICING_DETAIL_URL);

    await expect(page.getByRole("heading", { level: 1, name: "/pricing" })).toBeVisible();

    const cards = metricCards(page);
    await expect(cards).toHaveCount(5);
    await expect(cards.filter({ hasNotText: "No data" }).first()).toBeVisible();

    const byDevice = page.getByRole("table", { name: /by device class/ });
    await expect(byDevice.getByRole("rowheader", { name: "Mobile", exact: true })).toBeVisible();
  });
});

test("changing the time range puts it in the URL and the page renders under it", async ({ page }) => {
  await page.goto(PRICING_DETAIL_URL);
  await expect(metricCards(page)).toHaveCount(5);

  await page.getByLabel("Time range").selectOption({ label: "All time" });

  await expect(page).toHaveURL(/\/sites\/demo\/pages\/pricing\?range=all$/);
  // The server rendered the new URL: the select reflects it after hydration and the cards are back.
  await expect(page.getByLabel("Time range")).toHaveValue("all");
  await expect(metricCards(page)).toHaveCount(5);
});

test("the page detail has no serious or critical axe violations", async ({ page }) => {
  await page.goto(PRICING_DETAIL_URL);
  await expect(metricCards(page)).toHaveCount(5);

  await expectNoGatedViolations({ page, state: "page detail, default filters" });
});

// Paths that URL segments carry badly: a space and a percent sign must survive
// Next's decoding of the segments (which differs between the page and its
// metadata), and a trailing slash cannot be a segment at all. Each is ingested
// fresh, reached through its link on the overview, and must arrive as itself.
for (const path of ["/e2e/a b/100%", "/e2e/trailing/"]) {
  test(`a page at ${path} opens from the pages table as itself`, async ({ page, request }) => {
    await ingestPageview({ request, path });

    await page.goto("/");
    const pagesTable = page.getByRole("table", { name: /Pages with p75/ });
    await pagesTable.getByRole("rowheader", { name: path, exact: true }).getByRole("link").click();

    await expect(page.getByRole("heading", { level: 1, name: path })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} · `));
    await expect(metricCards(page)).toHaveCount(5);
  });
}
