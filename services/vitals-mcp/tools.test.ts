// Drives the MCP tools the way an agent host does: a real MCP Client talks to
// the server over the SDK's in-memory transport, and the server's GraphQL client
// talks to an in-process Yoga over the real schema, auth context, and a seeded
// in-memory database. Nothing between the model's call and SQLite is mocked.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createYoga } from "graphql-yoga";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeDb, type Db } from "@/db";
import { DEMO_SITE, seed } from "@/db/seed";
import { createContext } from "@/graphql/context";
import { schema } from "@/graphql/schema";
import { detectIncidents } from "@/incidents/detect";
import { createVitalsClient, type VitalsClient } from "./client";
import { MCP_TRANSITION_INCIDENT } from "./documents";
import { createVitalsMcpServer } from "./server";

const SERVICE_TOKEN = "test-service-token";
const BASE_URL = "http://vitals.test";
const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);

// createContext reads the expected token from the environment, as in production;
// the shared database it would open is replaced per test with a seeded :memory: one.
process.env.VITALS_SERVICE_TOKEN = SERVICE_TOKEN;
process.env.VITALS_DB_PATH = ":memory:";

interface Connection {
  mcp: Client;
  vitals: VitalsClient;
  close: () => Promise<void>;
}

let db: Db;
let open: Connection[] = [];

const connect = async ({ token = SERVICE_TOKEN }: { token?: string } = {}): Promise<Connection> => {
  const yoga = createYoga({
    schema,
    graphqlEndpoint: "/api/graphql",
    context: ({ request }) => ({ ...createContext({ request }), db }),
    logging: false,
  });
  const vitals = createVitalsClient({
    url: BASE_URL,
    serviceToken: token,
    fetch: async (input, init) => yoga.fetch(new Request(input, init)),
  });
  const server = createVitalsMcpServer({ client: vitals, baseUrl: BASE_URL });
  const mcp = new Client({ name: "test-agent", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);
  const connection = { mcp, vitals, close: async () => (await mcp.close(), await server.close()) };
  open = [...open, connection];
  return connection;
};

interface ToolOutcome {
  isError: boolean;
  // Parsed JSON from the tool's text content; tests narrow it with expect().
  body: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const callTool = async (mcp: Client, name: string, args: Record<string, unknown>): Promise<ToolOutcome> => {
  const result = (await mcp.callTool({ name, arguments: args })) as CallToolResult;
  const [first] = result.content;
  if (first?.type !== "text") {
    throw new Error(`${name} returned no text content`);
  }
  return { isError: result.isError === true, body: JSON.parse(first.text) };
};

const findIncident = async (mcp: Client, source: string): Promise<{ id: string; subject: string }> => {
  const { body } = await callTool(mcp, "list_open_incidents", {});
  const incident = body.incidents.find((candidate: { source: string }) => candidate.source === source);
  expect(incident).toBeDefined();
  return incident;
};

beforeEach(() => {
  db = makeDb(":memory:");
  seed(db, NOW);
  detectIncidents({ db, siteId: DEMO_SITE.id, now: NOW });
});

afterEach(async () => {
  await Promise.all(open.map((connection) => connection.close()));
  open = [];
});

describe("vitals MCP server", () => {
  it("offers exactly the five agent tools, and no human-only role", async () => {
    const { mcp } = await connect();

    const { tools } = await mcp.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "get_incident_context",
      "list_open_incidents",
      "record_step",
      "request_human_review",
      "submit_fix",
    ]);
    const recordStep = tools.find((tool) => tool.name === "record_step");
    expect(recordStep?.inputSchema.properties?.role).toMatchObject({
      enum: ["summarize", "propose-fix", "review", "open-pr"],
    });
  });

  it("lists the two seeded incidents with a one-line evidence summary each", async () => {
    const { mcp } = await connect();

    const { isError, body } = await callTool(mcp, "list_open_incidents", {});

    expect(isError).toBe(false);
    expect(body).toMatchObject({ siteId: "demo", status: "OPEN", count: 2 });
    const bySource = Object.fromEntries(body.incidents.map((incident: { source: string }) => [incident.source, incident]));
    expect(bySource.WEB_VITALS).toMatchObject({ subject: "/pricing", metric: "LCP", status: "OPEN" });
    expect(bySource.WEB_VITALS.evidence).toMatch(/^LCP p75 on \/pricing rose \d+ ms -> \d+ ms \(\+\d+%\)/);
    expect(bySource.HEALTH_CHECK).toMatchObject({ subject: "api-health", metric: null, status: "OPEN" });
    expect(bySource.HEALTH_CHECK.evidence).toMatch(/FAILING/);
  });

  it("gives a vitals incident its evidence and breakdown, and a health-check incident its check history", async () => {
    const { mcp } = await connect();
    const regression = await findIncident(mcp, "WEB_VITALS");
    const failingCheck = await findIncident(mcp, "HEALTH_CHECK");

    const vitals = await callTool(mcp, "get_incident_context", { incidentId: regression.id });
    const check = await callTool(mcp, "get_incident_context", { incidentId: failingCheck.id });

    expect(vitals.isError).toBe(false);
    expect(vitals.body.incident.vitalsEvidence).toMatchObject({ path: "/pricing", metric: "LCP" });
    expect(vitals.body.incident.vitalsEvidence.current.p75).toBeGreaterThan(vitals.body.incident.vitalsEvidence.baseline.p75);
    expect(vitals.body.incident.breakdown.byDevice.length).toBeGreaterThan(0);
    expect(vitals.body.checkHistory).toBeNull();
    expect(vitals.body.pageUrl).toBe(`${BASE_URL}/incidents/${regression.id}`);

    expect(check.isError).toBe(false);
    expect(check.body.incident.breakdown).toBeNull();
    expect(check.body.checkHistory.length).toBeGreaterThan(0);
    expect(check.body.checkHistory.length).toBeLessThanOrEqual(20);
    expect(check.body.checkHistory[0]).toMatchObject({ status: "FAILING" });
  });

  it("records a step that the incident's context then shows, with its usage", async () => {
    const { mcp } = await connect();
    const regression = await findIncident(mcp, "WEB_VITALS");

    const recorded = await callTool(mcp, "record_step", {
      incidentId: regression.id,
      role: "summarize",
      status: "succeeded",
      summary: "LCP on /pricing regressed after the hero image grew",
      detail: "Mobile on 3G carries most of the regression.",
      model: "claude-test",
      inputTokens: 1200,
      outputTokens: 300,
      costUsd: 0.0123,
    });
    const context = await callTool(mcp, "get_incident_context", { incidentId: regression.id });

    expect(recorded.isError).toBe(false);
    expect(recorded.body.step).toMatchObject({ role: "SUMMARIZE", status: "SUCCEEDED" });
    expect(context.body.incident.steps).toEqual([
      expect.objectContaining({
        role: "SUMMARIZE",
        status: "SUCCEEDED",
        summary: "LCP on /pricing regressed after the hero image grew",
        model: "claude-test",
        inputTokens: 1200,
        outputTokens: 300,
        costUsd: 0.0123,
      }),
    ]);
  });

  it("hands an incident to a person only once the agents have walked it to REVIEWED", async () => {
    const { mcp, vitals } = await connect();
    const regression = await findIncident(mcp, "WEB_VITALS");
    const summary = "Approve the image-size fix for /pricing?";

    const tooEarly = await callTool(mcp, "request_human_review", { incidentId: regression.id, summary });
    for (const to of ["TRIAGED", "FIX_PROPOSED", "REVIEWED"] as const) {
      await vitals.request(MCP_TRANSITION_INCIDENT, { id: regression.id, to });
    }
    const handedOver = await callTool(mcp, "request_human_review", { incidentId: regression.id, summary });
    const context = await callTool(mcp, "get_incident_context", { incidentId: regression.id });

    expect(tooEarly.isError).toBe(true);
    expect(tooEarly.body.error).toMatch(/OPEN|open/);
    expect(handedOver).toEqual({
      isError: false,
      body: {
        incidentId: regression.id,
        status: "AWAITING_HUMAN",
        pageUrl: `${BASE_URL}/incidents/${regression.id}`,
        summary,
      },
    });
    expect(context.body.incident.status).toBe("AWAITING_HUMAN");
  });

  it("turns a wrong service token into a tool error the agent can read, and records nothing", async () => {
    const { mcp } = await connect({ token: "not-the-token" });
    const regression = await findIncident(mcp, "WEB_VITALS");

    const refused = await callTool(mcp, "record_step", {
      incidentId: regression.id,
      role: "summarize",
      status: "running",
      summary: "should not land",
    });
    const context = await callTool(mcp, "get_incident_context", { incidentId: regression.id });

    expect(refused.isError).toBe(true);
    expect(refused.body.error).toMatch(/service token/);
    expect(context.body.incident.steps).toEqual([]);
  });

  it("submits a fix that the incident's context then shows as the latest revision, and refuses an invalid file set", async () => {
    const { mcp } = await connect();
    const regression = await findIncident(mcp, "WEB_VITALS");
    const fix = {
      incidentId: regression.id,
      targetRepo: "lakhtea/vitals",
      baseSha: "abc123",
      summary: "Serve a smaller hero image on /pricing",
    };

    const submitted = await callTool(mcp, "submit_fix", {
      ...fix,
      files: [{ path: "src/hero.ts", action: "modify", before: "export const WIDTH = 2400;\n", after: "export const WIDTH = 1200;\n" }],
    });
    const invalid = await callTool(mcp, "submit_fix", {
      ...fix,
      files: [{ path: "../outside.ts", action: "add", after: "x" }],
    });
    const context = await callTool(mcp, "get_incident_context", { incidentId: regression.id });

    expect(submitted).toEqual({
      isError: false,
      body: { revision: { id: expect.any(String), number: 1 }, pageUrl: `${BASE_URL}/incidents/${regression.id}` },
    });
    expect(invalid.isError).toBe(true);
    expect(invalid.body.error).toMatch(/"\.\."/);
    expect(context.body.incident.latestFixRevision).toEqual({
      number: 1,
      author: "AGENT",
      summary: fix.summary,
      reviewed: false,
      files: [{ path: "src/hero.ts", action: "MODIFY" }],
    });
  });

  it("reports an unknown incident as a tool error instead of failing the call", async () => {
    const { mcp } = await connect();

    const missing = await callTool(mcp, "get_incident_context", { incidentId: "does-not-exist" });

    expect(missing).toEqual({ isError: true, body: { error: 'No incident has id "does-not-exist".' } });
  });
});
