// The agent side of the human gate, end to end: a scripted agent holding the
// service token walks an incident along the agent path and records a step,
// and the incident page shows that step and says the incident is waiting for
// a person. The same calls without the token are refused. The incident is the
// spec's own, so a retry never finds it already moved. The MCP protocol layer
// on top of these calls is tested in services/vitals-mcp.
import { expect, test } from "@playwright/test";
import { graphql, openOwnIncident } from "./api";
import { E2E_SERVICE_TOKEN } from "./service-token";

const TRANSITION = `mutation Transition($id: ID!, $to: IncidentStatus!) { transitionIncident(id: $id, to: $to) { status } }`;
const RECORD_STEP = `mutation Record($id: ID!) {
  recordStep(incidentId: $id, role: SUMMARIZE, status: SUCCEEDED, summary: "The API returns 503 since the last deploy",
    detail: "Two failing observations in a row after eleven healthy ones.",
    usage: { model: "scripted-agent", inputTokens: 1200, outputTokens: 180, costUsd: 0.0123 }) { id }
}`;

test("an agent with the service token records a step and stops at the human gate", async ({ page, request }) => {
  const own = await openOwnIncident({ request, label: "agent" });

  // Without the token nothing moves.
  const refused = await graphql({ request, query: TRANSITION, variables: { id: own.id, to: "TRIAGED" } });
  expect(refused.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");

  const token = E2E_SERVICE_TOKEN;
  expect((await graphql({ request, query: RECORD_STEP, variables: { id: own.id }, token })).errors).toBeUndefined();
  for (const to of ["TRIAGED", "FIX_PROPOSED", "REVIEWED", "AWAITING_HUMAN"]) {
    const moved = await graphql({ request, query: TRANSITION, variables: { id: own.id, to }, token });
    expect(moved.errors, `transition to ${to}`).toBeUndefined();
  }
  // Even with the token, an agent cannot take the person's decision.
  const approval = await graphql({ request, query: TRANSITION, variables: { id: own.id, to: "APPROVED" }, token });
  expect(approval.errors?.[0]?.message).toMatch(/approved/);

  await page.goto(`/incidents/${own.id}`);
  const timeline = page.getByRole("list", { name: "Timeline" });
  await expect(timeline.getByText("The API returns 503 since the last deploy")).toBeVisible();
  await expect(timeline.getByText(/scripted-agent/)).toBeVisible();
  await expect(page.getByText(/Nothing leaves the repository until you approve/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
});
