// The fix review at the human gate, end to end: an agent (holding the service
// token) proposes a change on an incident of this test's own making, a person
// edits 5_000 to 10_000 in the browser's editor, saves it as revision 2, and
// approves by keyboard, which pins that revision. The incident is opened
// through the public checks endpoint so no other spec shares it.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { expectNoGatedViolations } from "./axe";
import { tabUntilFocused } from "./keyboard-helpers";
import { E2E_SERVICE_TOKEN } from "./service-token";

const DEMO_WRITE_KEY = "demo-write-key";
const CHECK_ID = "e2e-fix-review";
const FILE_PATH = "src/example.ts";

const graphql = async ({
  request,
  query,
  variables,
  token,
}: {
  request: APIRequestContext;
  query: string;
  variables?: Record<string, unknown>;
  token?: string;
}): Promise<{ data?: Record<string, unknown>; errors?: Array<{ message: string }> }> => {
  const response = await request.post("/api/graphql", {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    data: { query, variables },
  });
  return response.json();
};

const openOwnIncident = async (request: APIRequestContext): Promise<string> => {
  const pushed = await request.post("/api/checks", {
    headers: { authorization: `Bearer ${DEMO_WRITE_KEY}` },
    data: { siteId: "demo", checks: [{ id: CHECK_ID, name: "E2E fix review", status: "failing", observedAt: Date.now(), detail: "opened by e2e" }] },
  });
  expect(pushed.status()).toBe(202);
  expect((await graphql({ request, query: `mutation { detectIncidents(siteId: "demo") { opened } }` })).errors).toBeUndefined();
  const listed = await graphql({ request, query: `{ site(id: "demo") { incidents(status: OPEN) { id subject } } }` });
  const incident = (listed.data?.site as { incidents: Array<{ id: string; subject: string }> }).incidents.find(
    (candidate) => candidate.subject === CHECK_ID,
  );
  if (incident === undefined) {
    throw new Error("the e2e check did not open an incident");
  }
  return incident.id;
};

test("a person edits the agent's proposed change, saves it as a new revision, and approves that revision", async ({ page, request }) => {
  const incidentId = await openOwnIncident(request);
  const submitted = await graphql({
    request,
    token: E2E_SERVICE_TOKEN,
    query: `mutation Submit($id: ID!) {
      submitFixRevision(incidentId: $id, targetRepo: "lakhtea/vitals", baseSha: "e2e", summary: "Give the upstream call a timeout",
        files: [{ path: "${FILE_PATH}", action: MODIFY, beforeContent: "export const TIMEOUT_MS = 1_000;\\n", afterContent: "export const TIMEOUT_MS = 5_000;\\n" }]) { number }
    }`,
    variables: { id: incidentId },
  });
  expect(submitted.errors).toBeUndefined();

  await page.goto(`/incidents/${incidentId}`);
  await expect(page.getByRole("heading", { name: "Proposed change" })).toBeVisible();
  await expect(page.getByText(/Revision 1 by Agent/).first()).toBeVisible();

  const editButton = page.getByRole("button", { name: `Edit ${FILE_PATH}` });
  await tabUntilFocused({ page, target: editButton, maxTabs: 40 });
  await page.keyboard.press("Enter");
  const editor = page.getByRole("textbox", { name: `Edit ${FILE_PATH}` });
  await expect(editor).toBeVisible();
  await expectNoGatedViolations({ page, state: "incident detail, editor open" });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("export const TIMEOUT_MS = 10_000;");
  await page.getByLabel("Why you changed it (optional)").fill("Five seconds is too tight for the upstream's p99");
  await page.getByRole("button", { name: "Save as new revision" }).click();

  await expect(page.getByText(/Revision 2 by Person/).first()).toBeVisible();
  await expect(page.getByText("Edited since last review")).toBeVisible();
  await expect(page.getByRole("region", { name: `Diff of ${FILE_PATH}` })).toContainText("10_000");

  const approve = page.getByRole("button", { name: "Approve", exact: true });
  await tabUntilFocused({ page, target: approve, maxTabs: 40 });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);

  const pinned = await graphql({ request, query: `query Pinned($id: ID!) { incident(id: $id) { status approvedRevision { number author } } }`, variables: { id: incidentId } });
  expect(pinned.data?.incident).toEqual({ status: "APPROVED", approvedRevision: { number: 2, author: "HUMAN" } });
});
