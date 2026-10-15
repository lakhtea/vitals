// Builds the MCP server: one McpServer named "vitals" with the five tools
// registered. Transport-free, so main.ts can serve it over stdio and the tests
// can drive it over the SDK's in-memory transport.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VitalsClient } from "./client";
import {
  getIncidentContext,
  listOpenIncidents,
  recordStep,
  requestHumanReview,
  runTool,
  submitFix,
  type ToolDeps,
  type ToolMetadata,
} from "./tools";

export const VITALS_MCP_SERVER_NAME = "vitals";
export const VITALS_MCP_SERVER_VERSION = "0.1.0";

export interface VitalsMcpServerOptions {
  client: VitalsClient;
  /** The dashboard's origin; tool results link to pages under it. */
  baseUrl: string;
}

export const createVitalsMcpServer = ({ client, baseUrl }: VitalsMcpServerOptions): McpServer => {
  const server = new McpServer({ name: VITALS_MCP_SERVER_NAME, version: VITALS_MCP_SERVER_VERSION });
  const deps: ToolDeps = { client, baseUrl };

  // Registered one by one rather than through a generic helper: the SDK types
  // each callback's input from that tool's own schema, which a loop would erase.
  const config = ({ title, description, annotations }: ToolMetadata): Omit<ToolMetadata, "name"> => ({
    title,
    description,
    annotations,
  });
  // The SDK has already validated `input` against inputSchema before a handler runs.
  server.registerTool(
    listOpenIncidents.name,
    { ...config(listOpenIncidents), inputSchema: listOpenIncidents.inputSchema },
    (input) => runTool(() => listOpenIncidents.handler(deps, input)),
  );
  server.registerTool(
    getIncidentContext.name,
    { ...config(getIncidentContext), inputSchema: getIncidentContext.inputSchema },
    (input) => runTool(() => getIncidentContext.handler(deps, input)),
  );
  server.registerTool(
    recordStep.name,
    { ...config(recordStep), inputSchema: recordStep.inputSchema },
    (input) => runTool(() => recordStep.handler(deps, input)),
  );
  server.registerTool(
    submitFix.name,
    { ...config(submitFix), inputSchema: submitFix.inputSchema },
    (input) => runTool(() => submitFix.handler(deps, input)),
  );
  server.registerTool(
    requestHumanReview.name,
    { ...config(requestHumanReview), inputSchema: requestHumanReview.inputSchema },
    (input) => runTool(() => requestHumanReview.handler(deps, input)),
  );
  return server;
};
