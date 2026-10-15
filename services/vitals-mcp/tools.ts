// The five MCP tools: what a model reads about each (name, description, input
// schema) and the handler behind it. Handlers are pure over a VitalsClient, so
// every capability an agent has is a GraphQL operation the schema already guards.
import type { ShapeOutput, ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { FileAction, IncidentStatus, McpOpenIncidentsQuery, StepRole, StepStatus } from "./generated/graphql";
import type { VitalsClient } from "./client";
import {
  MCP_CHECK_HISTORY,
  MCP_INCIDENT_CONTEXT,
  MCP_OPEN_INCIDENTS,
  MCP_RECORD_STEP,
  MCP_SUBMIT_FIX,
  MCP_TRANSITION_INCIDENT,
} from "./documents";

export interface ToolDeps {
  client: VitalsClient;
  /** The dashboard's origin, used to hand the agent a link a person can open. */
  baseUrl: string;
}

/** What a model reads about a tool before deciding to call it. */
export interface ToolMetadata {
  name: string;
  title: string;
  description: string;
  annotations: ToolAnnotations;
}

export interface ToolDefinition<Shape extends ZodRawShapeCompat> extends ToolMetadata {
  inputSchema: Shape;
  handler: (deps: ToolDeps, input: ShapeOutput<Shape>) => Promise<unknown>;
}

const defineTool = <Shape extends ZodRawShapeCompat>(tool: ToolDefinition<Shape>): ToolDefinition<Shape> => tool;

/** How many past observations of a check an agent gets with a health-check incident. */
export const CHECK_HISTORY_LIMIT = 20;

// "human" is deliberately absent: a person's decision is made on the incident
// page, never recorded on their behalf by an agent.
const AGENT_STEP_ROLES = ["summarize", "propose-fix", "review", "open-pr"] as const;
const TO_STEP_ROLE: Record<(typeof AGENT_STEP_ROLES)[number], StepRole> = {
  summarize: "SUMMARIZE",
  "propose-fix": "PROPOSE_FIX",
  review: "REVIEW",
  "open-pr": "OPEN_PR",
};

const STEP_STATUSES = ["running", "succeeded", "failed"] as const;
const TO_STEP_STATUS: Record<(typeof STEP_STATUSES)[number], StepStatus> = {
  running: "RUNNING",
  succeeded: "SUCCEEDED",
  failed: "FAILED",
};

const INCIDENT_STATUSES = [
  "OPEN",
  "TRIAGED",
  "FIX_PROPOSED",
  "REVIEWED",
  "AWAITING_HUMAN",
  "APPROVED",
  "DISMISSED",
  "RESOLVED",
] as const satisfies readonly IncidentStatus[];

const incidentPageUrl = ({ baseUrl, incidentId }: { baseUrl: string; incidentId: string }): string =>
  new URL(`/incidents/${encodeURIComponent(incidentId)}`, baseUrl).toString();

type ListedIncident = NonNullable<McpOpenIncidentsQuery["site"]>["incidents"][number];

const formatMetricValue = ({ metric, value }: { metric: string; value: number }): string =>
  metric === "CLS" ? value.toFixed(3) : `${Math.round(value)} ms`;

/** One line a model can scan in a list: what moved, from what, to what. */
const summarizeEvidence = (incident: ListedIncident): string => {
  const vitals = incident.vitalsEvidence;
  if (vitals) {
    const before = formatMetricValue({ metric: vitals.metric, value: vitals.baseline.p75 });
    const after = formatMetricValue({ metric: vitals.metric, value: vitals.current.p75 });
    const percent = Math.round(vitals.relativeIncrease * 100);
    return `${vitals.metric} p75 on ${vitals.path} rose ${before} -> ${after} (+${percent}%), ${vitals.baseline.rating} -> ${vitals.current.rating}`;
  }
  const check = incident.checkEvidence;
  if (check) {
    const was = check.previousStatus ?? "no earlier observation";
    const detail = check.detail ? `: ${check.detail}` : "";
    return `${check.name} is ${check.status} (was ${was}; ${check.consecutive} in a row)${detail}`;
  }
  return "no evidence recorded";
};

export const listOpenIncidents = defineTool({
  name: "list_open_incidents",
  title: "List incidents to triage",
  description:
    "Lists a site's incidents in one status, newest first. Use it first, to find what needs attention; " +
    "it defaults to OPEN, the incidents no agent or person has picked up yet. Returns each incident's id, " +
    "source (WEB_VITALS regression or HEALTH_CHECK failure), subject (a URL path or a check id), metric, " +
    "status, detectedAt, and a one-line evidence summary. Call get_incident_context with an id for the full picture.",
  inputSchema: {
    siteId: z.string().min(1).default("demo").describe('The site to look at. The seeded demo site is "demo".'),
    status: z
      .enum(INCIDENT_STATUSES)
      .default("OPEN")
      .describe("Which incidents to list. OPEN is the triage queue; the others show work already in progress or decided."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ client }, { siteId, status }) => {
    const { site } = await client.request(MCP_OPEN_INCIDENTS, { siteId, status });
    if (!site) {
      throw new Error(`No site has id "${siteId}".`);
    }
    return {
      siteId,
      status,
      count: site.incidents.length,
      incidents: site.incidents.map((incident) => ({
        id: incident.id,
        source: incident.source,
        subject: incident.subject,
        metric: incident.metric,
        status: incident.status,
        detectedAt: incident.detectedAt,
        evidence: summarizeEvidence(incident),
      })),
    };
  },
});

export const getIncidentContext = defineTool({
  name: "get_incident_context",
  title: "Get everything about one incident",
  description:
    "Fetches everything known about one incident, as JSON: its status and subject; the frozen evidence the " +
    "detector saw (baseline and current p75 windows for a vitals regression, or the failing observation for a " +
    "health check); a per-device and per-connection breakdown of the regression (null for health checks); every " +
    "step recorded so far, oldest first; the person's note if they decided; and, for a health-check incident, the " +
    `check's last ${CHECK_HISTORY_LIMIT} observations, newest first. Use it before summarizing, proposing a fix, or reviewing.`,
  inputSchema: {
    incidentId: z.string().min(1).describe("The incident's id, from list_open_incidents."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ client, baseUrl }, { incidentId }) => {
    const { incident } = await client.request(MCP_INCIDENT_CONTEXT, { id: incidentId });
    if (!incident) {
      throw new Error(`No incident has id "${incidentId}".`);
    }
    const checkId = incident.checkEvidence?.checkId;
    const checkHistory = checkId
      ? await loadCheckHistory({ client, siteId: incident.siteId, checkId })
      : null;
    return { incident, checkHistory, pageUrl: incidentPageUrl({ baseUrl, incidentId: incident.id }) };
  },
});

const loadCheckHistory = async ({
  client,
  siteId,
  checkId,
}: {
  client: VitalsClient;
  siteId: string;
  checkId: string;
}): Promise<unknown[]> => {
  const { site } = await client.request(MCP_CHECK_HISTORY, { siteId, limit: CHECK_HISTORY_LIMIT });
  const check = site?.checks.find((candidate) => candidate.checkId === checkId);
  return check?.history ?? [];
};

export const recordStep = defineTool({
  name: "record_step",
  title: "Record a step on an incident's timeline",
  description:
    "Appends one step to an incident's timeline, which the person reviewing it reads on the incident page. " +
    "Record a step when you start (status running) and when you finish (succeeded or failed) a piece of work: " +
    "summarize the incident, propose a fix, review a proposed fix, or open a pull request. `summary` is one line " +
    "a person can scan; `detail` is the long form (what you saw, what you concluded). Report the model, tokens, " +
    "and cost you used so the person can see what the work took. Returns the recorded step. This does not change " +
    "the incident's status.",
  inputSchema: {
    incidentId: z.string().min(1).describe("The incident's id."),
    role: z
      .enum(AGENT_STEP_ROLES)
      .describe("Which part of the pipeline this step is."),
    status: z
      .enum(STEP_STATUSES)
      .describe("running while the work is in progress; succeeded or failed when it ends."),
    summary: z.string().min(1).describe("One line a person can read in the timeline."),
    detail: z.string().optional().describe("The long form: what was seen and concluded."),
    startedAt: z.iso.datetime().optional().describe("ISO 8601; defaults to now on the server."),
    finishedAt: z.iso.datetime().optional().describe("ISO 8601; set when the step has ended."),
    model: z.string().optional().describe("The model that did the work, e.g. its API model id."),
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    costUsd: z.number().nonnegative().optional().describe("What the work cost, in US dollars."),
    link: z.url().optional().describe("A URL to follow: the pull request, a trace, a commit."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ client, baseUrl }, input) => {
    const { model, inputTokens, outputTokens, costUsd } = input;
    const hasUsage = [model, inputTokens, outputTokens, costUsd].some((value) => value !== undefined);
    const { recordStep: step } = await client.request(MCP_RECORD_STEP, {
      incidentId: input.incidentId,
      role: TO_STEP_ROLE[input.role],
      status: TO_STEP_STATUS[input.status],
      summary: input.summary,
      detail: input.detail,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      usage: hasUsage ? { model, inputTokens, outputTokens, costUsd } : undefined,
      link: input.link,
    });
    return { step, pageUrl: incidentPageUrl({ baseUrl, incidentId: input.incidentId }) };
  },
});

const FILE_ACTIONS = ["add", "modify", "delete"] as const;
const TO_FILE_ACTION: Record<(typeof FILE_ACTIONS)[number], FileAction> = {
  add: "ADD",
  modify: "MODIFY",
  delete: "DELETE",
};

export const submitFix = defineTool({
  name: "submit_fix",
  title: "Propose a code change for an incident",
  description:
    "Proposes a change that fixes an incident, as whole file contents read at one commit: for each file, its " +
    "path relative to the repository root, the action (add, modify, or delete), `before` (the file at baseSha; " +
    "omit for add) and `after` (the new file; omit for delete). The server derives the diff a person reviews. " +
    "At most 20 files and 200,000 bytes per content; paths must be relative with no `..`. Each call writes the " +
    "next revision; the person may edit it into a newer one before approving. Refused once the incident is " +
    "approved, dismissed, or resolved. Returns the revision's id and number and the incident page's URL.",
  inputSchema: {
    incidentId: z.string().min(1).describe("The incident's id."),
    targetRepo: z.string().min(1).describe('The repository the change applies to, as "owner/name".'),
    baseSha: z.string().min(1).describe("The commit the before contents were read at."),
    summary: z.string().min(1).describe("One line: what the change does and why it fixes the incident."),
    files: z
      .array(
        z.object({
          path: z.string().min(1).describe("Relative to the repository root, forward slashes."),
          action: z.enum(FILE_ACTIONS),
          before: z.string().optional().describe("The file at baseSha; omit for add."),
          after: z.string().optional().describe("The new file; omit for delete."),
        }),
      )
      .min(1)
      .describe("Every file the change touches."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ client, baseUrl }, input) => {
    const { submitFixRevision: revision } = await client.request(MCP_SUBMIT_FIX, {
      incidentId: input.incidentId,
      targetRepo: input.targetRepo,
      baseSha: input.baseSha,
      summary: input.summary,
      files: input.files.map((file) => ({
        path: file.path,
        action: TO_FILE_ACTION[file.action],
        beforeContent: file.before,
        afterContent: file.after,
      })),
    });
    return {
      revision: { id: revision.id, number: revision.number },
      pageUrl: incidentPageUrl({ baseUrl, incidentId: input.incidentId }),
    };
  },
});

export const requestHumanReview = defineTool({
  name: "request_human_review",
  title: "Hand the incident to a person",
  description:
    "Moves an incident to AWAITING_HUMAN, the status in which a person approves or dismisses it. Use it last, " +
    "after the pipeline's work is recorded and the incident is REVIEWED; the server refuses it from any other " +
    "status. It records no step itself, so record your review step first. Returns the new status and the " +
    "incident page's URL; tell the person to open that link, with your one-line summary.",
  inputSchema: {
    incidentId: z.string().min(1).describe("The incident's id."),
    summary: z.string().min(1).describe("One line for the person: what they are being asked to decide. Echoed back with the link."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ client, baseUrl }, { incidentId, summary }) => {
    const { transitionIncident } = await client.request(MCP_TRANSITION_INCIDENT, { id: incidentId, to: "AWAITING_HUMAN" });
    return {
      incidentId: transitionIncident.id,
      status: transitionIncident.status,
      pageUrl: incidentPageUrl({ baseUrl, incidentId: transitionIncident.id }),
      summary,
    };
  },
});

/**
 * Runs a handler and shapes its outcome as MCP content: JSON text on success,
 * a tool error carrying the message on failure. A tool error is something the
 * model can read and react to; an exception would end the call with a protocol error.
 */
export const runTool = async (work: () => Promise<unknown>): Promise<CallToolResult> => {
  try {
    const result = await work();
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: message }) }] };
  }
};
