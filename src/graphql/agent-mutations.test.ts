// The boundary the agents cross (M13): the service token on the two mutations
// only agents call, the agent path through the incident state machine, the
// steps an agent records, and the per-dimension breakdown it reads. Driven
// through real GraphQL documents against an in-memory database.
import { asc } from "drizzle-orm";
import { graphql } from "graphql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeDb, type Db } from "@/db";
import { type IncidentInsert, incidents, incidentSteps, metricEvents, pageviews, sessions, sites } from "@/db/schema";
import { DEMO_SITE, seed } from "@/db/seed";
import { detectIncidents } from "@/incidents/detect";
import { type Context, createContext } from "./context";
import { schema } from "./schema";

const SITE_ID = "t";
const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

let db: Db;

const exec = ({
  source,
  variableValues,
  isService = true,
}: {
  source: string;
  variableValues?: Record<string, unknown>;
  isService?: boolean;
}) => {
  const contextValue: Context = { db, isService };
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

const insertIncident = (row: IncidentInsert): number => db.insert(incidents).values(row).returning().get().id;

const statusOf = (id: number): string | undefined =>
  db.select().from(incidents).all().find((incident) => incident.id === id)?.status;

const TRANSITION = `mutation Transition($id: ID!, $to: IncidentStatus!) { transitionIncident(id: $id, to: $to) { id status updatedAt } }`;

const RECORD_STEP = `
  mutation Record(
    $incidentId: ID!, $role: StepRole!, $status: StepStatus!, $summary: String!, $detail: String,
    $startedAt: DateTime, $finishedAt: DateTime, $usage: StepUsageInput, $link: String
  ) {
    recordStep(
      incidentId: $incidentId, role: $role, status: $status, summary: $summary, detail: $detail,
      startedAt: $startedAt, finishedAt: $finishedAt, usage: $usage, link: $link
    ) { id role status summary detail startedAt finishedAt model inputTokens outputTokens costUsd link }
  }
`;

const summaryStep = (incidentId: number, overrides: Record<string, unknown> = {}) => ({
  incidentId: String(incidentId),
  role: "SUMMARIZE",
  status: "SUCCEEDED",
  summary: "LCP regressed on /pricing for mobile visitors",
  ...overrides,
});

beforeEach(() => {
  db = makeDb(":memory:");
  db.insert(sites).values({ id: SITE_ID, name: "T", createdAt: T0 }).run();
});

describe("the service token", () => {
  it.each([
    ["recordStep", RECORD_STEP, (id: number) => summaryStep(id)],
    ["transitionIncident", TRANSITION, (id: number) => ({ id: String(id), to: "TRIAGED" })],
  ] as const)("refuses %s without the token, with code UNAUTHENTICATED, and writes nothing", async (_name, source, variables) => {
    const id = insertIncident(vitalsIncident());

    const result = await exec({ source, variableValues: variables(id), isService: false });

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
    expect(result.errors?.[0]?.message).toMatch(/VITALS_SERVICE_TOKEN/);
    expect(db.select().from(incidents).all()).toMatchObject([{ id, status: "open", updatedAt: T0 }]);
    expect(db.select().from(incidentSteps).all()).toEqual([]);
  });

  it("refuses an unknown incident id the same way without the token, so a guesser learns nothing", async () => {
    const result = await exec({ source: TRANSITION, variableValues: { id: "9999", to: "TRIAGED" }, isService: false });

    expect(result.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });

  it("allows both mutations with the token", async () => {
    const id = insertIncident(vitalsIncident());

    const moved = await exec({ source: TRANSITION, variableValues: { id: String(id), to: "TRIAGED" } });
    const recorded = await exec({ source: RECORD_STEP, variableValues: summaryStep(id) });

    expect(moved.errors).toBeUndefined();
    expect(recorded.errors).toBeUndefined();
    expect(statusOf(id)).toBe("triaged");
    expect(db.select().from(incidentSteps).all()).toHaveLength(1);
  });
});

describe("createContext", () => {
  const saved = { token: process.env.VITALS_SERVICE_TOKEN, dbPath: process.env.VITALS_DB_PATH };

  const restore = (name: "VITALS_SERVICE_TOKEN" | "VITALS_DB_PATH", value: string | undefined): void => {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  };

  beforeEach(() => {
    // createContext opens the shared handle; point it at memory, never at the developer's database file.
    process.env.VITALS_DB_PATH = ":memory:";
  });

  afterEach(() => {
    restore("VITALS_SERVICE_TOKEN", saved.token);
    restore("VITALS_DB_PATH", saved.dbPath);
  });

  const withAuthorization = (value: string | null): Request =>
    new Request("http://localhost/api/graphql", {
      method: "POST",
      headers: value === null ? {} : { authorization: value },
    });

  it("recognises the service token only when the server has one and the request presents exactly it", () => {
    process.env.VITALS_SERVICE_TOKEN = "s3cret-service-token";

    expect(createContext({ request: withAuthorization("Bearer s3cret-service-token") }).isService).toBe(true);
    expect(createContext({ request: withAuthorization("bearer s3cret-service-token") }).isService).toBe(true);
    expect(createContext({ request: withAuthorization("Bearer wrong-service-token!") }).isService).toBe(false);
    expect(createContext({ request: withAuthorization("Bearer s3cret") }).isService).toBe(false);
    expect(createContext({ request: withAuthorization("s3cret-service-token") }).isService).toBe(false);
    expect(createContext({ request: withAuthorization(null) }).isService).toBe(false);
    // Server rendering calls it with no request at all.
    expect(createContext().isService).toBe(false);
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
  ])("never recognises a service caller when the env var is %s, whatever the header says", (_label, token) => {
    restore("VITALS_SERVICE_TOKEN", token);

    expect(createContext({ request: withAuthorization("Bearer ") }).isService).toBe(false);
    expect(createContext({ request: withAuthorization("Bearer anything") }).isService).toBe(false);
  });
});

describe("transitionIncident", () => {
  it("walks the agent path open -> triaged -> fix-proposed -> reviewed -> awaiting-human, bumping updatedAt", async () => {
    const id = insertIncident(vitalsIncident());

    for (const to of ["TRIAGED", "FIX_PROPOSED", "REVIEWED", "AWAITING_HUMAN"]) {
      const result = await exec({ source: TRANSITION, variableValues: { id: String(id), to } });
      expect(result.errors).toBeUndefined();
      expect(result.data?.transitionIncident).toMatchObject({ id: String(id), status: to });
    }
    const [row] = db.select().from(incidents).all();
    expect(row?.status).toBe("awaiting-human");
    expect(row?.updatedAt).toBeGreaterThan(T0);
  });

  it.each(["APPROVED", "DISMISSED", "RESOLVED", "OPEN"])(
    "refuses an agent move to %s, saying who owns it, and changes nothing",
    async (to) => {
      const id = insertIncident(vitalsIncident({ status: "triaged" }));

      const result = await exec({ source: TRANSITION, variableValues: { id: String(id), to } });

      expect(result.data).toBeNull();
      expect(result.errors?.[0]?.message).toMatch(/Agents cannot move an incident to/);
      expect(result.errors?.[0]?.message).toMatch(/person/);
      expect(result.errors?.[0]?.message).toMatch(/detector/);
      expect(statusOf(id)).toBe("triaged");
    },
  );

  it("refuses to skip a stage, naming both statuses", async () => {
    const id = insertIncident(vitalsIncident());

    const result = await exec({ source: TRANSITION, variableValues: { id: String(id), to: "REVIEWED" } });

    expect(result.errors?.[0]?.message).toBe(`Incident ${id} cannot move from "open" to "reviewed"`);
    expect(statusOf(id)).toBe("open");
  });

  it("refuses to move a dismissed incident back onto the agent path", async () => {
    const id = insertIncident(vitalsIncident({ status: "dismissed" }));

    const result = await exec({ source: TRANSITION, variableValues: { id: String(id), to: "TRIAGED" } });

    expect(result.errors?.[0]?.message).toBe(`Incident ${id} cannot move from "dismissed" to "triaged"`);
  });

  it.each(["9999", "not-a-number"])("refuses the unknown incident id %j", async (id) => {
    const result = await exec({ source: TRANSITION, variableValues: { id, to: "TRIAGED" } });

    expect(result.errors?.[0]?.message).toBe(`No incident with id "${id}"`);
  });
});

describe("recordStep", () => {
  it("stores a step with usage and link, and the timeline shows it after the human decision", async () => {
    const id = insertIncident(vitalsIncident());
    const approved = await exec({
      source: `mutation { approveIncident(id: "${id}", note: "Real") { id } }`,
      isService: false,
    });
    expect(approved.errors).toBeUndefined();
    const startedAt = new Date(Date.now() + 1_000).toISOString();
    const finishedAt = new Date(Date.now() + 61_000).toISOString();

    const recorded = await exec({
      source: RECORD_STEP,
      variableValues: summaryStep(id, {
        role: "OPEN_PR",
        summary: "  Opened a PR that lazy-loads the hero image  ",
        detail: "The hero image grew from 180 KB to 1.4 MB in the last deploy.",
        startedAt,
        finishedAt,
        usage: { model: "claude-sonnet-4-5", inputTokens: 12_400, outputTokens: 860, costUsd: 0.0501 },
        link: "https://github.com/example/site/pull/42",
      }),
    });

    expect(recorded.errors).toBeUndefined();
    expect(recorded.data?.recordStep).toMatchObject({
      role: "OPEN_PR",
      status: "SUCCEEDED",
      summary: "Opened a PR that lazy-loads the hero image",
      startedAt,
      finishedAt,
      model: "claude-sonnet-4-5",
      inputTokens: 12_400,
      outputTokens: 860,
      costUsd: 0.0501,
      link: "https://github.com/example/site/pull/42",
    });

    const timeline = await exec({ source: `{ incident(id: "${id}") { status updatedAt steps { role summary } } }` });
    expect(timeline.data?.incident).toMatchObject({
      status: "APPROVED",
      steps: [
        { role: "HUMAN", summary: "Approved" },
        { role: "OPEN_PR", summary: "Opened a PR that lazy-loads the hero image" },
      ],
    });
  });

  it("defaults startedAt to now and bumps the incident's updatedAt", async () => {
    const id = insertIncident(vitalsIncident());
    const before = Date.now();

    const recorded = await exec({ source: RECORD_STEP, variableValues: summaryStep(id) });

    expect(recorded.errors).toBeUndefined();
    const [step] = db.select().from(incidentSteps).orderBy(asc(incidentSteps.id)).all();
    expect(step?.startedAt).toBeGreaterThanOrEqual(before);
    expect(step?.finishedAt).toBeNull();
    expect(db.select().from(incidents).all()[0]?.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("refuses role HUMAN: an agent cannot write a person's decision", async () => {
    const id = insertIncident(vitalsIncident());

    const result = await exec({ source: RECORD_STEP, variableValues: summaryStep(id, { role: "HUMAN" }) });

    expect(result.errors?.[0]?.message).toMatch(/Agents cannot record HUMAN steps/);
    expect(db.select().from(incidentSteps).all()).toEqual([]);
  });

  it.each(["dismissed", "resolved"] as const)("refuses a %s incident", async (status) => {
    const id = insertIncident(vitalsIncident({ status }));

    const result = await exec({ source: RECORD_STEP, variableValues: summaryStep(id) });

    expect(result.errors?.[0]?.message).toBe(`Incident ${id} is "${status}"; a closed incident takes no more steps`);
    expect(db.select().from(incidentSteps).all()).toEqual([]);
    expect(db.select().from(incidents).all()[0]?.updatedAt).toBe(T0);
  });

  it.each([
    ["a non-http link", { link: "javascript:alert(1)" }, /link must be an http or https URL/],
    ["a link that is not a URL", { link: "the PR" }, /link must be an http or https URL/],
    [
      "finishedAt before startedAt",
      { startedAt: new Date(T0).toISOString(), finishedAt: new Date(T0 - 1).toISOString() },
      /finishedAt must not be before startedAt/,
    ],
    ["a blank summary", { summary: "   " }, /summary must be 1 to 300 characters/],
    ["a 301-character summary", { summary: "x".repeat(301) }, /summary must be 1 to 300 characters/],
    ["a 20,001-character detail", { detail: "x".repeat(20_001) }, /detail must be at most 20000 characters/],
    ["negative tokens", { usage: { inputTokens: -1 } }, /must not be negative/],
    ["a negative cost", { usage: { costUsd: -0.01 } }, /must not be negative/],
  ])("refuses %s and writes nothing", async (_label, overrides, message) => {
    const id = insertIncident(vitalsIncident());

    const result = await exec({ source: RECORD_STEP, variableValues: summaryStep(id, overrides) });

    expect(result.errors?.[0]?.message).toMatch(message);
    expect(db.select().from(incidentSteps).all()).toEqual([]);
  });

  it("refuses an unknown incident id", async () => {
    const result = await exec({ source: RECORD_STEP, variableValues: summaryStep(9999) });

    expect(result.errors?.[0]?.message).toBe('No incident with id "9999"');
  });
});

describe("Incident.breakdown", () => {
  const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);

  const BREAKDOWN_QUERY = `
    query Breakdown($siteId: ID!) {
      site(id: $siteId) {
        incidents {
          source subject metric
          vitalsEvidence { baseline { sampleCount } current { sampleCount } }
          breakdown {
            byDevice { value baselineP75 baselineSampleCount currentP75 currentSampleCount }
            byConnection { value baselineP75 baselineSampleCount currentP75 currentSampleCount }
          }
        }
      }
    }
  `;

  interface Row {
    value: string;
    baselineP75: number | null;
    baselineSampleCount: number;
    currentP75: number | null;
    currentSampleCount: number;
  }
  interface IncidentResult {
    source: string;
    subject: string;
    metric: string | null;
    vitalsEvidence: { baseline: { sampleCount: number }; current: { sampleCount: number } } | null;
    breakdown: { byDevice: Row[]; byConnection: Row[] } | null;
  }

  const sum = (rows: Row[], key: "baselineSampleCount" | "currentSampleCount"): number =>
    rows.reduce((total, row) => total + row[key], 0);

  it("splits the seeded /pricing LCP regression so every sample lands in exactly one group, and is null for a check", async () => {
    seed(db, NOW);
    expect(detectIncidents({ db, siteId: DEMO_SITE.id, now: NOW }).opened).toBe(2);

    const result = await exec({ source: BREAKDOWN_QUERY, variableValues: { siteId: DEMO_SITE.id }, isService: false });

    expect(result.errors).toBeUndefined();
    const found = (result.data?.site as { incidents: IncidentResult[] }).incidents;
    const pricing = found.find((incident) => incident.subject === "/pricing" && incident.metric === "LCP");
    const check = found.find((incident) => incident.source === "HEALTH_CHECK");
    expect(check?.breakdown).toBeNull();

    const evidence = pricing?.vitalsEvidence;
    const breakdown = pricing?.breakdown;
    if (evidence === null || evidence === undefined || breakdown === null || breakdown === undefined) {
      throw new Error("the seeded /pricing LCP incident should carry evidence and a breakdown");
    }
    for (const rows of [breakdown.byDevice, breakdown.byConnection]) {
      expect(rows.length).toBeGreaterThan(1);
      expect(sum(rows, "baselineSampleCount")).toBe(evidence.baseline.sampleCount);
      expect(sum(rows, "currentSampleCount")).toBe(evidence.current.sampleCount);
      const order = rows.map((row) => row.currentSampleCount);
      expect(order).toEqual([...order].sort((a, b) => b - a));
    }
    expect(breakdown.byDevice.map((row) => row.value).every((value) => ["DESKTOP", "MOBILE", "TABLET", "UNKNOWN"].includes(value))).toBe(true);
    expect(
      breakdown.byConnection.map((row) => row.value).every((value) => ["SLOW_2G", "TWO_G", "THREE_G", "FOUR_G", "UNKNOWN"].includes(value)),
    ).toBe(true);
  });

  it("computes the nearest-rank p75 per group, and reads null and 0 for a window the group is missing from", async () => {
    const id = insertIncident(vitalsIncident());
    // Mobile: four baseline samples and five current ones; tablet only in the current window.
    const samples: Array<{ device: "mobile" | "tablet"; at: number; lcp: number }> = [
      ...[1000, 2000, 3000, 4000].map((lcp) => ({ device: "mobile" as const, at: T0 - 36 * HOUR, lcp })),
      ...[5000, 6000, 7000, 8000].map((lcp) => ({ device: "mobile" as const, at: T0 - 12 * HOUR, lcp })),
      { device: "tablet", at: T0 - 6 * HOUR, lcp: 9000 },
      // Exactly on the boundary: half-open windows put it in the current one only.
      { device: "mobile", at: T0 - 24 * HOUR, lcp: 4500 },
      // Outside both windows: must not count.
      { device: "mobile", at: T0 + HOUR, lcp: 99_999 },
    ];
    samples.forEach(({ device, at, lcp }, index) => {
      const sessionId = `s${index}`;
      const pageviewId = `${sessionId}-p`;
      db.insert(sessions)
        .values({ id: sessionId, siteId: SITE_ID, startedAt: at, deviceClass: device, connectionType: "4g", userAgentFamily: "Chrome" })
        .run();
      db.insert(pageviews).values({ id: pageviewId, sessionId, path: "/pricing", startedAt: at }).run();
      db.insert(metricEvents)
        .values({ pageviewId, metricId: `${pageviewId}-LCP`, name: "LCP", value: lcp, rating: "good", recordedAt: at + lcp })
        .run();
    });

    const result = await exec({
      source: `{ incident(id: "${id}") { breakdown { byDevice { value baselineP75 baselineSampleCount currentP75 currentSampleCount } byConnection { value currentSampleCount } } } }`,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.incident).toEqual({
      breakdown: {
        byDevice: [
          // Nearest rank: ceil(0.75 * 4) = 3rd of 4, ceil(0.75 * 5) = 4th of 5.
          { value: "MOBILE", baselineP75: 3000, baselineSampleCount: 4, currentP75: 7000, currentSampleCount: 5 },
          { value: "TABLET", baselineP75: null, baselineSampleCount: 0, currentP75: 9000, currentSampleCount: 1 },
        ],
        byConnection: [{ value: "FOUR_G", currentSampleCount: 6 }],
      },
    });
  });
});
