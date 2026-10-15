// The fix review at the human gate, end to end: an agent (holding the service
// token) proposes a change on an incident of this test's own making, a person
// edits 5_000 to 10_000 in the browser's editor, saves it as revision 2, and
// approves by keyboard, which pins that revision. The incident is the spec's
// own (e2e/api.ts), unique per attempt, so neither another spec nor a retry shares it.
import { expect, test } from "@playwright/test";
import { graphql, openOwnIncident } from "./api";
import { expectNoGatedViolations } from "./axe";
import { tabUntilFocused } from "./keyboard-helpers";
import { E2E_SERVICE_TOKEN } from "./service-token";

const FILE_PATH = "src/example.ts";

test("a person edits the agent's proposed change, saves it as a new revision, and approves that revision", async ({ page, request }) => {
  const { id: incidentId } = await openOwnIncident({ request, label: "fix-review" });
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
