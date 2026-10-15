// Display strings for incidents and health checks: status labels, the tone a
// status pill takes, an incident's title, and one-line summaries of evidence
// and of a recorded step. No React here, so Server Components, stories, and
// the overview rows can all ask the same questions and get the same answers.
import type { CheckStatus } from "@/checks/status";
import type { IncidentEvidence } from "@/incidents/evidence";
import type { IncidentSource, IncidentStatus, StepRole, StepStatus } from "@/incidents/vocabulary";
import { formatMetricValue, formatSampleCount } from "@/vitals/format";
import type { MetricName, MetricRating } from "@/vitals/metrics";

const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Open",
  triaged: "Triaged",
  "fix-proposed": "Fix proposed",
  reviewed: "Reviewed",
  "awaiting-human": "Awaiting review",
  approved: "Approved",
  dismissed: "Dismissed",
  resolved: "Resolved",
};

export const incidentStatusLabel = (status: IncidentStatus): string => INCIDENT_STATUS_LABELS[status];

const INCIDENT_SOURCE_LABELS: Record<IncidentSource, string> = {
  "web-vitals": "Web vitals",
  "health-check": "Health check",
};

export const incidentSourceLabel = (source: IncidentSource): string => INCIDENT_SOURCE_LABELS[source];

const STEP_ROLE_LABELS: Record<StepRole, string> = {
  summarize: "Summarize",
  "propose-fix": "Propose fix",
  review: "Review",
  "open-pr": "Open PR",
  human: "Human",
};

export const stepRoleLabel = (role: StepRole): string => STEP_ROLE_LABELS[role];

const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

export const stepStatusLabel = (status: StepStatus): string => STEP_STATUS_LABELS[status];

const CHECK_STATUS_LABELS: Record<CheckStatus, string> = {
  ok: "OK",
  degraded: "Degraded",
  failing: "Failing",
};

export const checkStatusLabel = (status: CheckStatus): string => CHECK_STATUS_LABELS[status];

/**
 * The dashboard has exactly three status colours, the web.dev rating colours,
 * so every pill reuses them as a "tone": poor is red, needs-improvement is
 * amber, good is green. A null tone is the neutral muted pill.
 */
export type PillTone = MetricRating | null;

const CHECK_STATUS_TONES: Record<CheckStatus, MetricRating> = {
  failing: "poor",
  degraded: "needs-improvement",
  ok: "good",
};

export const checkStatusTone = (status: CheckStatus): MetricRating => CHECK_STATUS_TONES[status];

/**
 * Red marks the states that wait on a person (open, awaiting review); amber the
 * states where work is in progress, including approved, which means a human
 * confirmed the incident is real and a fix is on its way; green the one state
 * where the condition has cleared. Dismissed is neutral: nothing was wrong.
 */
const INCIDENT_STATUS_TONES: Record<IncidentStatus, PillTone> = {
  open: "poor",
  triaged: "needs-improvement",
  "fix-proposed": "needs-improvement",
  reviewed: "needs-improvement",
  "awaiting-human": "poor",
  approved: "needs-improvement",
  dismissed: null,
  resolved: "good",
};

export const incidentStatusTone = (status: IncidentStatus): PillTone => INCIDENT_STATUS_TONES[status];

/** Running is neutral: the step is neither a success nor a failure yet. */
const STEP_STATUS_TONES: Record<StepStatus, PillTone> = {
  running: null,
  succeeded: "good",
  failed: "poor",
};

export const stepStatusTone = (status: StepStatus): PillTone => STEP_STATUS_TONES[status];

/** "LCP on /pricing" for a vitals regression, the check's name ("API health") for a health check. */
export const incidentTitle = (incident: {
  source: IncidentSource;
  subject: string;
  metric: MetricName | null;
  evidence: IncidentEvidence;
}): string => {
  if (incident.source === "health-check") {
    return incident.evidence.kind === "health-check" ? incident.evidence.name : incident.subject;
  }
  if (incident.metric === null) {
    return incident.subject;
  }
  return `${incident.metric} on ${incident.subject}`;
};

const PERCENT = 100;

/** 1.5 -> "+150%", so a regression always reads as growth; a drop keeps its own minus sign. */
export const formatRelativeIncrease = (relativeIncrease: number): string => {
  const percent = Math.round(relativeIncrease * PERCENT);
  return percent > 0 ? `+${percent}%` : `${percent}%`;
};

const numberFormat = new Intl.NumberFormat("en-US");

/**
 * The one line of evidence shown in a table row:
 * vitals -> "p75 2.6 s to 6.5 s (+150%), 31 and 29 samples";
 * check  -> "Failing for 2 observations (was OK): HTTP 503 from /healthz",
 * where the "(was ...)" and ": detail" parts are omitted when unknown.
 */
export const describeEvidence = (evidence: IncidentEvidence): string => {
  if (evidence.kind === "web-vitals") {
    const { metric, baseline, current, relativeIncrease } = evidence;
    const from = formatMetricValue({ name: metric, value: baseline.p75 });
    const to = formatMetricValue({ name: metric, value: current.p75 });
    const samples = `${numberFormat.format(baseline.sampleCount)} and ${formatSampleCount(current.sampleCount)}`;
    return `p75 ${from} to ${to} (${formatRelativeIncrease(relativeIncrease)}), ${samples}`;
  }

  const { status, previousStatus, consecutive, detail } = evidence;
  const observations = consecutive === 1 ? "observation" : "observations";
  const was = previousStatus === null ? "" : ` (was ${checkStatusLabel(previousStatus)})`;
  const suffix = detail === null ? "" : `: ${detail}`;
  return `${checkStatusLabel(status)} for ${numberFormat.format(consecutive)} ${observations}${was}${suffix}`;
};

/** A check's reading with its unit when it has one: "412 ms", "99.2 %", or just "503". */
export const formatCheckValue = ({ value, unit }: { value: number | null; unit: string | null }): string | null => {
  if (value === null) {
    return null;
  }
  const formatted = numberFormat.format(value);
  return unit === null ? formatted : `${formatted} ${unit}`;
};

/** ISO string or epoch milliseconds -> the ISO string a <time dateTime> attribute wants. */
export const isoTimestamp = (value: string | number): string => new Date(value).toISOString();

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.round(milliseconds / MILLISECONDS_PER_SECOND);
  if (totalSeconds < 1) {
    return "under 1 s";
  }
  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${totalSeconds} s`;
  }
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
};

/** How long a finished step took ("2 min 10 s"); null while it is still running. */
export const describeStepDuration = ({
  startedAt,
  finishedAt,
}: {
  startedAt: string | number;
  finishedAt: string | number | null;
}): string | null => {
  if (finishedAt === null) {
    return null;
  }
  return formatDuration(new Date(finishedAt).getTime() - new Date(startedAt).getTime());
};

const costFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/**
 * What a step cost, for the muted line under its summary: each part appears
 * only when recorded, e.g. "claude-sonnet-4-5 · 12,400 tokens in · 1,830 tokens out · $0.0412".
 * Null when nothing was recorded, which is every human step.
 */
export const describeStepUsage = ({
  model,
  inputTokens,
  outputTokens,
  costUsd,
}: {
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}): string | null => {
  const parts: string[] = [];
  if (model !== null) {
    parts.push(model);
  }
  if (inputTokens !== null) {
    parts.push(`${numberFormat.format(inputTokens)} tokens in`);
  }
  if (outputTokens !== null) {
    parts.push(`${numberFormat.format(outputTokens)} tokens out`);
  }
  if (costUsd !== null) {
    parts.push(costFormat.format(costUsd));
  }
  return parts.length === 0 ? null : parts.join(" · ");
};
