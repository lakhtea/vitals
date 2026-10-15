// Drives the check and incident fields and the two human decisions through real
// GraphQL documents against an in-memory database. The state machine is the
// contract the dashboard and (from M15) the agents both rely on, so the suite
// proves what a human may and may not do, and that a refusal changes nothing.
import { graphql } from "graphql";
import { beforeEach, describe, expect, it } from "vitest";
import { makeDb, type Db } from "@/db";
import { createQueryCounter, type QueryCounter } from "@/db/query-counter";
import { type CheckInsert, checks, type IncidentInsert, incidents, incidentSteps, sites } from "@/db/schema";
import type { Context } from "./context";
import { schema } from "./schema";

const SITE_ID = "t";
const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

let counter: QueryCounter;
let db: Db;

const exec = (source: string, variableValues?: Record<string, unknown>) => {
  const contextValue: Context = { db };
  return graphql({ schema, source, contextValue, variableValues });
};

const vitalsIncident = (overrides: Partial<IncidentInsert> = {}): IncidentInsert => ({
  siteId: SITE_ID,
  source: "web-vitals",
  subject: "/pricing",
  metric: "LCP",
  status: "open",
  detectedAt: T0,
  updatedAt: T0,
  evidence: {
    kind: "web-vitals",
    path: "/pricing",
    metric: "LCP",
    baseline: { from: T0 - 48 * HOUR, to: T0 - 24 * HOUR, p75: 2100, sampleCount: 40, rating: "good" },
    current: { from: T0 - 24 * HOUR, to: T0, p75: 3400, sampleCount: 36, rating: "needs-improvement" },
    relativeIncrease: 0.619,
  },
  ...overrides,
});

const checkIncident = (overrides: Partial<IncidentInsert> = {}): IncidentInsert => ({
  siteId: SITE_ID,
  source: "health-check",
  subject: "api-health",
  metric: null,
  status: "open",
  detectedAt: T0 + HOUR,
  updatedAt: T0 + HOUR,
  evidence: {
    kind: "health-check",
    checkId: "api-health",
    name: "API health",
    status: "failing",
    previousStatus: "ok",
    consecutive: 1,
    value: null,
    unit: null,
    observedAt: T0 + HOUR,
    detail: "HTTP 503 from /healthz",
  },
  ...overrides,
});

const insertIncident = (row: IncidentInsert): number => db.insert(incidents).values(row).returning().get().id;

const observation = (checkId: string, status: CheckInsert["status"], observedAt: number): CheckInsert => ({
  siteId: SITE_ID,
  checkId,
  name: checkId,
  status,
  observedAt,
});

const INCIDENT_FIELDS = `
  id status note metric
  vitalsEvidence { path metric relativeIncrease baseline { p75 rating sampleCount } current { p75 rating } }
  checkEvidence { checkId status previousStatus consecutive detail }
  steps { role status summary detail startedAt finishedAt }
`;

beforeEach(() => {
  counter = createQueryCounter();
  db = makeDb(":memory:", { logger: counter.logger });
  db.insert(sites).values({ id: SITE_ID, name: "T", createdAt: T0 }).run();
});

describe("approveIncident and dismissIncident", () => {
  it("approves an open incident, stores the note, and records exactly one human step", async () => {
    const id = insertIncident(vitalsIncident());

    const result = await exec(
      `mutation Approve($id: ID!, $note: String) { approveIncident(id: $id, note: $note) { ${INCIDENT_FIELDS} } }`,
      { id: String(id), note: "Real: the hero image doubled in size." },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.approveIncident).toMatchObject({
      id: String(id),
      status: "APPROVED",
      note: "Real: the hero image doubled in size.",
      steps: [
        {
          role: "HUMAN",
          status: "SUCCEEDED",
          summary: "Approved",
          detail: "Real: the hero image doubled in size.",
        },
      ],
    });
    expect(db.select().from(incidents).all()).toMatchObject([{ id, status: "approved" }]);
  });

  it("refuses to dismiss an approved incident, naming both statuses, and changes nothing", async () => {
    const id = insertIncident(vitalsIncident({ status: "approved", note: "keep" }));

    const result = await exec(`mutation { dismissIncident(id: "${id}", note: "noise") { id status } }`);

    expect(result.errors?.[0]?.message).toMatch(/approved/);
    expect(result.errors?.[0]?.message).toMatch(/dismissed/);
    expect(result.data).toBeNull();
    expect(db.select().from(incidents).all()).toMatchObject([{ id, status: "approved", note: "keep" }]);
    expect(db.select().from(incidentSteps).all()).toEqual([]);
  });

  it.each(["9999", "not-a-number"])("refuses to dismiss the unknown incident id %j", async (id) => {
    const result = await exec(`mutation Dismiss($id: ID!) { dismissIncident(id: $id) { id } }`, { id });

    expect(result.errors?.[0]?.message).toMatch(/No incident/);
    expect(db.select().from(incidentSteps).all()).toEqual([]);
  });
});

describe("Query.incident", () => {
  it("exposes the evidence that matches the incident's source and null for the other shape", async () => {
    const vitalsId = insertIncident(vitalsIncident());
    const checkId = insertIncident(checkIncident());
    const query = `query Incident($id: ID!) { incident(id: $id) { ${INCIDENT_FIELDS} } }`;

    const vitals = await exec(query, { id: String(vitalsId) });
    const check = await exec(query, { id: String(checkId) });

    expect(vitals.errors).toBeUndefined();
    expect(vitals.data?.incident).toMatchObject({
      metric: "LCP",
      vitalsEvidence: {
        path: "/pricing",
        metric: "LCP",
        relativeIncrease: 0.619,
        baseline: { p75: 2100, rating: "GOOD", sampleCount: 40 },
        current: { p75: 3400, rating: "NEEDS_IMPROVEMENT" },
      },
      checkEvidence: null,
      steps: [],
    });
    expect(check.errors).toBeUndefined();
    expect(check.data?.incident).toMatchObject({
      metric: null,
      vitalsEvidence: null,
      checkEvidence: { checkId: "api-health", status: "FAILING", previousStatus: "OK", consecutive: 1 },
    });
  });

  it.each(["9999", "not-a-number"])("answers null, not an error, for the unknown id %j", async (id) => {
    const result = await exec(`query Incident($id: ID!) { incident(id: $id) { id } }`, { id });

    expect(result.errors).toBeUndefined();
    expect(result.data?.incident).toBeNull();
  });
});

describe("Site.checks and Site.incidents", () => {
  it("shows each check at its newest observation, worst status first, and incidents newest first", async () => {
    db.insert(checks)
      .values([
        observation("db", "ok", T0),
        observation("db", "degraded", T0 + HOUR),
        observation("api-health", "failing", T0),
        observation("api-health", "ok", T0 + 2 * HOUR),
        observation("queue", "failing", T0),
      ])
      .run();
    insertIncident(vitalsIncident());
    insertIncident(checkIncident());

    const result = await exec(`{
      site(id: "${SITE_ID}") {
        checks { checkId status observedAt history { status } }
        incidents { subject detectedAt }
        openOnly: incidents(status: OPEN) { subject }
      }
    }`);

    expect(result.errors).toBeUndefined();
    expect(result.data?.site).toEqual({
      checks: [
        { checkId: "queue", status: "FAILING", observedAt: new Date(T0).toISOString(), history: [{ status: "FAILING" }] },
        {
          checkId: "db",
          status: "DEGRADED",
          observedAt: new Date(T0 + HOUR).toISOString(),
          history: [{ status: "DEGRADED" }, { status: "OK" }],
        },
        {
          checkId: "api-health",
          status: "OK",
          observedAt: new Date(T0 + 2 * HOUR).toISOString(),
          history: [{ status: "OK" }, { status: "FAILING" }],
        },
      ],
      incidents: [
        { subject: "api-health", detectedAt: new Date(T0 + HOUR).toISOString() },
        { subject: "/pricing", detectedAt: new Date(T0).toISOString() },
      ],
      openOnly: [{ subject: "api-health" }, { subject: "/pricing" }],
    });
  });

  // Measured with the committed QueryCounter, like the Page.metrics pin in metrics.test.ts.
  it("loads the overview's checks and incidents for a site in a fixed number of SQL statements", async () => {
    db.insert(checks)
      .values([observation("db", "ok", T0), observation("queue", "failing", T0)])
      .run();
    insertIncident(vitalsIncident());
    insertIncident(checkIncident());
    counter.reset();

    const result = await exec(`{ site(id: "${SITE_ID}") { checks { checkId } incidents { id } } }`);

    expect(result.errors).toBeUndefined();
    // 1 (site) + 1 (latest check per id) + 1 (incidents).
    expect(counter.count()).toBe(3);
  });
});
