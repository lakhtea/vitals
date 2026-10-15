// The on-call path end to end: the seeded incidents are listed on the
// overview, and a person reaches an incident and dismisses it with a note
// using the keyboard alone, the decision is recorded in the timeline, and axe
// passes on the detail page. The dismissal uses an incident of its own, so a
// retry or a parallel spec never finds it already decided.
import { expect, test } from "@playwright/test";
import { expectNoGatedViolations } from "./axe";
import { openOwnIncident } from "./api";
import { tabUntilFocused } from "./keyboard-helpers";
import { openSeededOverview } from "./overview";

const INCIDENTS_TABLE_NAME = "Incidents, newest first";
const REGRESSION_TITLE = "LCP on /pricing";

test("the seeded regression and the failing check are listed on the overview", async ({ page }) => {
  await openSeededOverview(page);
  const incidents = page.getByRole("table", { name: INCIDENTS_TABLE_NAME });
  await expect(incidents.getByRole("link", { name: REGRESSION_TITLE })).toBeVisible();
  await expect(incidents.getByRole("link", { name: "API health" })).toBeVisible();
});

test("a person reaches an incident and dismisses it with a note by keyboard alone", async ({ page, request }) => {
  const own = await openOwnIncident({ request, label: "dismiss" });
  await openSeededOverview(page);
  const link = page.getByRole("table", { name: INCIDENTS_TABLE_NAME }).getByRole("link", { name: own.name });

  await tabUntilFocused({ page, target: link, maxTabs: 40 });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/incidents/${own.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: own.name })).toBeVisible();

  const note = page.getByLabel("Note (optional)");
  const dismiss = page.getByRole("button", { name: "Dismiss", exact: true });
  await tabUntilFocused({ page, target: note, maxTabs: 20 });
  await page.keyboard.type("Deploy rolled back at 09:40");
  await tabUntilFocused({ page, target: dismiss, maxTabs: 4 });
  await page.keyboard.press("Enter");

  await expect(page.getByText("Dismissed", { exact: true }).first()).toBeVisible();
  const timeline = page.getByRole("list", { name: "Timeline" });
  await expect(timeline.getByText("Deploy rolled back at 09:40")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dismiss", exact: true })).toHaveCount(0);

  // A dynamic page streams its metadata after its content, so right after router.refresh() there is a
  // moment with no <title>; a slow CI runner caught axe in it. Audit the settled page.
  await expect(page).toHaveTitle(`${own.name} - Vitals`);
  await expectNoGatedViolations({ page, state: "incident detail, dismissed" });
});

test("the incident page is complete without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  const incidents = page.getByRole("table", { name: INCIDENTS_TABLE_NAME });
  await incidents.getByRole("link", { name: "API health" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "API health" })).toBeVisible();
  // The evidence the detector froze is in the server HTML: the streak and the application's own detail.
  await expect(page.getByRole("definition").filter({ hasText: /^\d+ observations?$/ })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "HTTP 503 from /healthz" })).toBeVisible();
  await context.close();
});
