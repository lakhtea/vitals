// The one write an agent makes to an incident's timeline: record a step. It
// validates what a model-driven caller might get wrong (empty summaries,
// negative token counts, a non-URL link) and refuses what an agent must never
// do (write a human decision, touch a closed incident) before anything is written.
import { eq } from "drizzle-orm";
import { type IncidentStatus, isTerminalIncidentStatus, type StepRole, type StepStatus } from "@/incidents/vocabulary";
import type { Db } from "../index";
import { incidents, incidentSteps, type IncidentStepRow } from "../schema";

export const MAX_STEP_SUMMARY_LENGTH = 300;
export const MAX_STEP_DETAIL_LENGTH = 20_000;

export interface StepUsage {
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export interface RecordStepInput {
  incidentId: number;
  role: StepRole;
  status: StepStatus;
  summary: string;
  detail: string | null;
  /** Null means "now". */
  startedAt: number | null;
  finishedAt: number | null;
  usage: StepUsage | null;
  link: string | null;
}

export type RecordStepResult =
  | { ok: true; step: IncidentStepRow }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "human-role" }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "terminal"; status: IncidentStatus };

const isHttpUrl = (text: string): boolean => {
  if (!URL.canParse(text)) {
    return false;
  }
  const { protocol } = new URL(text);
  return protocol === "http:" || protocol === "https:";
};

const isNonNegative = (value: number | null): boolean => value === null || (Number.isFinite(value) && value >= 0);

/** The first problem with the input, or null when it can be stored as given. */
const validationProblem = ({
  input,
  summary,
  startedAt,
}: {
  input: RecordStepInput;
  summary: string;
  startedAt: number;
}): string | null => {
  if (summary.length === 0 || summary.length > MAX_STEP_SUMMARY_LENGTH) {
    return `summary must be 1 to ${MAX_STEP_SUMMARY_LENGTH} characters after trimming (got ${summary.length})`;
  }
  if (input.detail !== null && input.detail.length > MAX_STEP_DETAIL_LENGTH) {
    return `detail must be at most ${MAX_STEP_DETAIL_LENGTH} characters (got ${input.detail.length})`;
  }
  if (input.finishedAt !== null && input.finishedAt < startedAt) {
    return "finishedAt must not be before startedAt";
  }
  if (input.link !== null && !isHttpUrl(input.link)) {
    return `link must be an http or https URL (got "${input.link}")`;
  }
  const usage = input.usage;
  if (usage !== null && ![usage.inputTokens, usage.outputTokens, usage.costUsd].every(isNonNegative)) {
    return "usage.inputTokens, usage.outputTokens, and usage.costUsd must not be negative";
  }
  return null;
};

/**
 * Appends one step to an incident's timeline and bumps the incident's
 * updatedAt, together or not at all. Approved incidents still take steps (the
 * agent that opens the PR works after approval); dismissed and resolved ones do not.
 */
export const recordStep = ({ db, input, now }: { db: Db; input: RecordStepInput; now: number }): RecordStepResult => {
  if (input.role === "human") {
    return { ok: false, reason: "human-role" };
  }
  const summary = input.summary.trim();
  const startedAt = input.startedAt ?? now;
  const problem = validationProblem({ input, summary, startedAt });
  if (problem !== null) {
    return { ok: false, reason: "invalid", message: problem };
  }

  return db.transaction((tx): RecordStepResult => {
    const incident = tx
      .select({ status: incidents.status })
      .from(incidents)
      .where(eq(incidents.id, input.incidentId))
      .get();
    if (incident === undefined) {
      return { ok: false, reason: "not-found" };
    }
    if (isTerminalIncidentStatus(incident.status)) {
      return { ok: false, reason: "terminal", status: incident.status };
    }

    const step = tx
      .insert(incidentSteps)
      .values({
        incidentId: input.incidentId,
        role: input.role,
        status: input.status,
        startedAt,
        finishedAt: input.finishedAt,
        summary,
        detail: input.detail,
        model: input.usage?.model ?? null,
        inputTokens: input.usage?.inputTokens ?? null,
        outputTokens: input.usage?.outputTokens ?? null,
        costUsd: input.usage?.costUsd ?? null,
        link: input.link,
      })
      .returning()
      .get();
    tx.update(incidents).set({ updatedAt: now }).where(eq(incidents.id, input.incidentId)).run();
    return { ok: true, step };
  });
};
