import { expect, test } from "@playwright/test";

// A scripted "browser session" delivers one batch the way the library will,
// then the dashboard is expected to show the new page.
test("a posted batch shows up on the dashboard", async ({ page, request }) => {
  const now = Date.now();
  const response = await request.post("/api/collect", {
    data: {
      siteId: "demo",
      session: {
        id: `e2e-session-${now}`,
        startedAt: now - 5_000,
        deviceClass: "desktop",
        connectionType: "4g",
        userAgentFamily: "Chrome",
      },
      pageview: { id: `e2e-pageview-${now}`, path: "/e2e/ingested", startedAt: now - 5_000 },
      events: [
        { id: `e2e-lcp-${now}`, name: "LCP", value: 1850, recordedAt: now - 3_000 },
        { id: `e2e-cls-${now}`, name: "CLS", value: 0.02, recordedAt: now - 1_000 },
      ],
    },
  });

  expect(response.status()).toBe(202);

  await page.goto("/");
  await expect(page.getByRole("cell", { name: "/e2e/ingested" })).toBeVisible();
});
