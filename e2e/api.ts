// Direct API calls the e2e specs share: GraphQL with or without the agents'
// service token, and an incident of the spec's own making. A spec that changes
// an incident works on its own, so it never races another spec or its own retry.
import { expect, type APIRequestContext } from "@playwright/test";

const DEMO_SITE_ID = "demo";
const DEMO_WRITE_KEY = "demo-write-key";

export interface GraphqlResult {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

export const graphql = async ({
  request,
  query,
  variables,
  token,
}: {
  request: APIRequestContext;
  query: string;
  variables?: Record<string, unknown>;
  /** The agents' service token; omit to call as a person. */
  token?: string;
}): Promise<GraphqlResult> => {
  const response = await request.post("/api/graphql", {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    data: { query, variables },
  });
  return (await response.json()) as GraphqlResult;
};

export interface OwnIncident {
  id: string;
  checkId: string;
  /** The check's name, which is also the incident's title on the overview and its page. */
  name: string;
}

/** Pushes a failing check unique to this attempt and runs detection, which opens an incident for it. */
export const openOwnIncident = async ({ request, label }: { request: APIRequestContext; label: string }): Promise<OwnIncident> => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const checkId = `e2e-${label}-${suffix}`;
  const name = `E2E ${label} ${suffix}`;

  const pushed = await request.post("/api/checks", {
    headers: { authorization: `Bearer ${DEMO_WRITE_KEY}` },
    data: {
      siteId: DEMO_SITE_ID,
      checks: [{ id: checkId, name, status: "failing", observedAt: Date.now(), detail: "opened by an e2e spec" }],
    },
  });
  expect(pushed.status()).toBe(202);

  const detected = await graphql({ request, query: `mutation { detectIncidents(siteId: "${DEMO_SITE_ID}") { opened } }` });
  expect(detected.errors).toBeUndefined();

  const listed = await graphql({ request, query: `{ site(id: "${DEMO_SITE_ID}") { incidents { id subject } } }` });
  const incidents = (listed.data?.site as { incidents: Array<{ id: string; subject: string }> }).incidents;
  const incident = incidents.find((candidate) => candidate.subject === checkId);
  if (incident === undefined) {
    throw new Error(`detection did not open an incident for ${checkId}`);
  }
  return { id: incident.id, checkId, name };
};
