// The agent side of the human gate, end to end: a scripted agent holding the
// service token walks the seeded API-health incident along the agent path and
// records a step, and the incident page shows that step and says the incident
// is waiting for a person. The same calls without the token are refused. The
// MCP protocol layer on top of these calls is tested in services/vitals-mcp.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { E2E_SERVICE_TOKEN } from "./service-token";

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
}): Promise<{ data?: Record<string, unknown>; errors?: Array<{ message: string; extensions?: { code?: string } }> }> => {
  const response = await request.post("/api/graphql", {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    data: { query, variables },
  });
  return response.json();
};

const TRANSITION = `mutation Transition($id: ID!, $to: IncidentStatus!) { transitionIncident(id: $id, to: $to) { status } }`;
const RECORD_STEP = `mutation Record($id: ID!) {
  recordStep(incidentId: $id, role: SUMMARIZE, status: SUCCEEDED, summary: "The API returns 503 since the last deploy",
    detail: "Two failing observations in a row after eleven healthy ones.",
    usage: { model: "scripted-agent", inputTokens: 1200, outputTokens: 180, costUsd: 0.0123 }) { id }
}`;

test("an agent with the service token records a step and stops at the human gate", async ({ page, request }) => {
  const listed = await graphql({ request, query: `{ site(id: "demo") { incidents { id subject } } }` });
  const incidents = (listed.data?.site as { incidents: Array<{ id: string; subject: string }> }).incidents;
  const apiHealth = incidents.find((incident) => incident.subject === "api-health");
  if (apiHealth === undefined) {
    throw new Error("the seeded api-health incident is missing");
  }

  // Without the token nothing moves.
  const refused = await graphql({ request, query: TRANSITION, variables: { id: apiHealth.id, to: "TRIAGED" } });
  expect(refused.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");

  const token = E2E_SERVICE_TOKEN;
  expect((await graphql({ request, query: RECORD_STEP, variables: { id: apiHealth.id }, token })).errors).toBeUndefined();
  for (const to of ["TRIAGED", "FIX_PROPOSED", "REVIEWED", "AWAITING_HUMAN"]) {
    const moved = await graphql({ request, query: TRANSITION, variables: { id: apiHealth.id, to }, token });
    expect(moved.errors, `transition to ${to}`).toBeUndefined();
  }
  // Even with the token, an agent cannot take the person's decision.
  const approval = await graphql({ request, query: TRANSITION, variables: { id: apiHealth.id, to: "APPROVED" }, token });
  expect(approval.errors?.[0]?.message).toMatch(/approved/);

  await page.goto(`/incidents/${apiHealth.id}`);
  const timeline = page.getByRole("list", { name: "Timeline" });
  await expect(timeline.getByText("The API returns 503 since the last deploy")).toBeVisible();
  await expect(timeline.getByText(/scripted-agent/)).toBeVisible();
  await expect(page.getByText(/Nothing leaves the repository until you approve/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
});
