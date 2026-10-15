// Translates GraphQL enum values (NEEDS_IMPROVEMENT, FIX_PROPOSED) and wire
// shapes (ISO strings, two nullable evidence objects) into the domain types the
// components speak ("needs-improvement", "fix-proposed", one IncidentEvidence),
// so components stay ignorant of GraphQL and the schema's naming rules stay in
// the schema.
import type { CheckStatus } from "@/checks/status";
import type {
  CheckStatus as GqlCheckStatus,
  IncidentDetailFragment,
  IncidentSource as GqlIncidentSource,
  IncidentStatus as GqlIncidentStatus,
  MetricName as GqlMetricName,
  MetricRating as GqlMetricRating,
  FileAction as GqlFileAction,
  FixAuthor as GqlFixAuthor,
  StepRole as GqlStepRole,
  StepStatus as GqlStepStatus,
} from "@/graphql/generated/graphql";
import type { IncidentEvidence, WindowSummary } from "@/incidents/evidence";
import type { IncidentSource, IncidentStatus, StepRole, StepStatus } from "@/incidents/vocabulary";
import type { MetricName, MetricRating } from "@/vitals/metrics";
import type { FixRevisionData, FixRevisionSummary } from "./components/FixReview";
import type { IncidentDetailData } from "./components/IncidentDetail";
import type { FileActionName, FixAuthorName } from "./fix-review";

const RATING_FROM_GRAPHQL: Record<GqlMetricRating, MetricRating> = {
  GOOD: "good",
  NEEDS_IMPROVEMENT: "needs-improvement",
  POOR: "poor",
};

const NAME_FROM_GRAPHQL: Record<GqlMetricName, MetricName> = {
  LCP: "LCP",
  CLS: "CLS",
  INP: "INP",
  TTFB: "TTFB",
  FCP: "FCP",
};

const CHECK_STATUS_FROM_GRAPHQL: Record<GqlCheckStatus, CheckStatus> = {
  OK: "ok",
  DEGRADED: "degraded",
  FAILING: "failing",
};

const INCIDENT_SOURCE_FROM_GRAPHQL: Record<GqlIncidentSource, IncidentSource> = {
  WEB_VITALS: "web-vitals",
  HEALTH_CHECK: "health-check",
};

const INCIDENT_STATUS_FROM_GRAPHQL: Record<GqlIncidentStatus, IncidentStatus> = {
  OPEN: "open",
  TRIAGED: "triaged",
  FIX_PROPOSED: "fix-proposed",
  REVIEWED: "reviewed",
  AWAITING_HUMAN: "awaiting-human",
  APPROVED: "approved",
  DISMISSED: "dismissed",
  RESOLVED: "resolved",
};

const STEP_ROLE_FROM_GRAPHQL: Record<GqlStepRole, StepRole> = {
  SUMMARIZE: "summarize",
  PROPOSE_FIX: "propose-fix",
  REVIEW: "review",
  OPEN_PR: "open-pr",
  HUMAN: "human",
};

const STEP_STATUS_FROM_GRAPHQL: Record<GqlStepStatus, StepStatus> = {
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
};

const FIX_AUTHOR_FROM_GRAPHQL: Record<GqlFixAuthor, FixAuthorName> = { AGENT: "agent", HUMAN: "human" };

const FILE_ACTION_FROM_GRAPHQL: Record<GqlFileAction, FileActionName> = { ADD: "add", MODIFY: "modify", DELETE: "delete" };

export const toMetricRating = (rating: GqlMetricRating): MetricRating => RATING_FROM_GRAPHQL[rating];

export const toMetricName = (name: GqlMetricName): MetricName => NAME_FROM_GRAPHQL[name];

export const toCheckStatus = (status: GqlCheckStatus): CheckStatus => CHECK_STATUS_FROM_GRAPHQL[status];

export const toIncidentSource = (source: GqlIncidentSource): IncidentSource => INCIDENT_SOURCE_FROM_GRAPHQL[source];

export const toIncidentStatus = (status: GqlIncidentStatus): IncidentStatus => INCIDENT_STATUS_FROM_GRAPHQL[status];

type WireEvidence = Pick<IncidentDetailFragment, "vitalsEvidence" | "checkEvidence">;
type WireWindow = NonNullable<IncidentDetailFragment["vitalsEvidence"]>["baseline"];

const toWindowSummary = (window: WireWindow): WindowSummary => ({
  from: Date.parse(window.from),
  to: Date.parse(window.to),
  p75: window.p75,
  sampleCount: window.sampleCount,
  rating: toMetricRating(window.rating),
});

/**
 * The evidence column is one JSON value per incident; GraphQL carries it as
 * two nullable objects, exactly one of them set. This puts it back together.
 * The overview and the detail page select the same evidence fields, so both
 * pass through here.
 */
export const toIncidentEvidence = ({ vitalsEvidence, checkEvidence }: WireEvidence): IncidentEvidence => {
  if (vitalsEvidence !== null) {
    return {
      kind: "web-vitals",
      path: vitalsEvidence.path,
      metric: toMetricName(vitalsEvidence.metric),
      baseline: toWindowSummary(vitalsEvidence.baseline),
      current: toWindowSummary(vitalsEvidence.current),
      relativeIncrease: vitalsEvidence.relativeIncrease,
    };
  }
  if (checkEvidence !== null) {
    return {
      kind: "health-check",
      checkId: checkEvidence.checkId,
      name: checkEvidence.name,
      status: toCheckStatus(checkEvidence.status),
      previousStatus: checkEvidence.previousStatus === null ? null : toCheckStatus(checkEvidence.previousStatus),
      consecutive: checkEvidence.consecutive,
      value: checkEvidence.value,
      unit: checkEvidence.unit,
      observedAt: Date.parse(checkEvidence.observedAt),
      detail: checkEvidence.detail,
    };
  }
  throw new Error("An incident arrived with neither vitals nor check evidence; the schema guarantees one.");
};

export const toIncidentDetail = (incident: IncidentDetailFragment): IncidentDetailData => ({
  id: incident.id,
  source: toIncidentSource(incident.source),
  subject: incident.subject,
  metric: incident.metric === null ? null : toMetricName(incident.metric),
  status: toIncidentStatus(incident.status),
  detectedAt: incident.detectedAt,
  updatedAt: incident.updatedAt,
  resolvedAt: incident.resolvedAt,
  note: incident.note,
  evidence: toIncidentEvidence(incident),
  steps: incident.steps.map((step) => ({
    id: step.id,
    role: STEP_ROLE_FROM_GRAPHQL[step.role],
    status: STEP_STATUS_FROM_GRAPHQL[step.status],
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    summary: step.summary,
    detail: step.detail,
    model: step.model,
    inputTokens: step.inputTokens,
    outputTokens: step.outputTokens,
    costUsd: step.costUsd,
    link: step.link,
  })),
});

type WireRevision = NonNullable<IncidentDetailFragment["latestFixRevision"]>;

export const toFixRevisionData = (revision: WireRevision): FixRevisionData => ({
  id: revision.id,
  number: revision.number,
  author: FIX_AUTHOR_FROM_GRAPHQL[revision.author],
  createdAt: revision.createdAt,
  summary: revision.summary,
  targetRepo: revision.targetRepo,
  baseSha: revision.baseSha,
  reviewed: revision.reviewed,
  files: revision.files.map((file) => ({
    path: file.path,
    action: FILE_ACTION_FROM_GRAPHQL[file.action],
    diff: file.diff,
    afterContent: file.afterContent,
  })),
});

export const toFixHistory = (revisions: IncidentDetailFragment["fixRevisions"]): FixRevisionSummary[] =>
  revisions.map((revision) => ({
    number: revision.number,
    author: FIX_AUTHOR_FROM_GRAPHQL[revision.author],
    createdAt: revision.createdAt,
    summary: revision.summary,
  }));
