// Incident and what hangs off it: the evidence the detector stored (one of two
// shapes, exposed as two nullable fields so a client branches on which one is
// present rather than on a union), the steps timeline, and the DetectionResult
// a detector run reports, and the per-device and per-connection breakdown of a
// vitals incident's two windows.
import { type BreakdownGroup, loadIncidentBreakdown } from "@/db/queries/breakdown";
import { listStepsForIncident } from "@/db/queries/incidents";
import type { IncidentRow, IncidentStepRow } from "@/db/schema";
import type { DetectionResult } from "@/incidents/detect";
import type { CheckEvidence, VitalsEvidence, WindowSummary } from "@/incidents/evidence";
import { builder } from "../builder";
import {
  CONNECTION_TYPE_ENUM_VALUES,
  CheckStatusEnum,
  DEVICE_CLASS_ENUM_VALUES,
  enumNameOf,
  IncidentSourceEnum,
  IncidentStatusEnum,
  MetricNameEnum,
  MetricRatingEnum,
  StepRoleEnum,
  StepStatusEnum,
} from "../enums";

const WindowSummaryType = builder.objectRef<WindowSummary>("WindowSummary").implement({
  description: "One aggregation window, half-open [from, to), summarised to the number web.dev rates: the p75.",
  fields: (t) => ({
    from: t.field({ type: "DateTime", resolve: (window) => window.from }),
    to: t.field({ type: "DateTime", resolve: (window) => window.to }),
    p75: t.exposeFloat("p75"),
    sampleCount: t.exposeInt("sampleCount"),
    rating: t.field({ type: MetricRatingEnum, resolve: (window) => window.rating }),
  }),
});

const VitalsEvidenceType = builder.objectRef<VitalsEvidence>("VitalsEvidence").implement({
  description: "Why a vitals regression was opened: the baseline window against the current one.",
  fields: (t) => ({
    path: t.exposeString("path"),
    metric: t.field({ type: MetricNameEnum, resolve: (evidence) => evidence.metric }),
    baseline: t.field({ type: WindowSummaryType, resolve: (evidence) => evidence.baseline }),
    current: t.field({ type: WindowSummaryType, resolve: (evidence) => evidence.current }),
    relativeIncrease: t.exposeFloat("relativeIncrease", {
      description: "(current.p75 - baseline.p75) / baseline.p75; 0.5 means half again as slow.",
    }),
  }),
});

const CheckEvidenceType = builder.objectRef<CheckEvidence>("CheckEvidence").implement({
  description: "Why a health-check incident was opened: the observation that tripped the detector.",
  fields: (t) => ({
    checkId: t.exposeString("checkId"),
    name: t.exposeString("name"),
    status: t.field({ type: CheckStatusEnum, resolve: (evidence) => evidence.status }),
    previousStatus: t.field({
      type: CheckStatusEnum,
      nullable: true,
      description: "The status observed before this one; null for a check's first observation.",
      resolve: (evidence) => evidence.previousStatus,
    }),
    consecutive: t.exposeInt("consecutive", { description: "How many observations in a row have been at `status`." }),
    value: t.exposeFloat("value", { nullable: true }),
    unit: t.exposeString("unit", { nullable: true }),
    observedAt: t.field({ type: "DateTime", resolve: (evidence) => evidence.observedAt }),
    detail: t.exposeString("detail", { nullable: true }),
  }),
});

export const IncidentStepType = builder.objectRef<IncidentStepRow>("IncidentStep").implement({
  description: "One entry in an incident's timeline: an agent's work (from M15) or a human decision.",
  fields: (t) => ({
    id: t.exposeID("id"),
    role: t.field({ type: StepRoleEnum, resolve: (step) => step.role }),
    status: t.field({ type: StepStatusEnum, resolve: (step) => step.status }),
    startedAt: t.field({ type: "DateTime", resolve: (step) => step.startedAt }),
    finishedAt: t.field({ type: "DateTime", nullable: true, resolve: (step) => step.finishedAt }),
    summary: t.exposeString("summary", { description: "One line a human can read in the timeline." }),
    detail: t.exposeString("detail", { nullable: true, description: "The long form: what was seen and concluded, or the human's note." }),
    model: t.exposeString("model", { nullable: true }),
    inputTokens: t.exposeInt("inputTokens", { nullable: true }),
    outputTokens: t.exposeInt("outputTokens", { nullable: true }),
    costUsd: t.exposeFloat("costUsd", { nullable: true }),
    link: t.exposeString("link", { nullable: true, description: "A URL to follow: the PR, a trace, a commit." }),
  }),
});

interface BreakdownRow {
  value: string;
  baselineP75: number | null;
  baselineSampleCount: number;
  currentP75: number | null;
  currentSampleCount: number;
}

interface IncidentBreakdown {
  byDevice: BreakdownRow[];
  byConnection: BreakdownRow[];
}

const BreakdownRowType = builder.objectRef<BreakdownRow>("BreakdownRow").implement({
  description: "One device class or connection type, measured in both evidence windows.",
  fields: (t) => ({
    value: t.exposeString("value", { description: "Display value of the dimension, e.g. MOBILE or FOUR_G." }),
    baselineP75: t.exposeFloat("baselineP75", { nullable: true }),
    baselineSampleCount: t.exposeInt("baselineSampleCount"),
    currentP75: t.exposeFloat("currentP75", { nullable: true }),
    currentSampleCount: t.exposeInt("currentSampleCount"),
  }),
});

const IncidentBreakdownType = builder.objectRef<IncidentBreakdown>("IncidentBreakdown").implement({
  fields: (t) => ({
    byDevice: t.field({ type: [BreakdownRowType], resolve: (breakdown) => breakdown.byDevice }),
    byConnection: t.field({ type: [BreakdownRowType], resolve: (breakdown) => breakdown.byConnection }),
  }),
});

/** Wire spelling for each group, then the most-affected first: current sample count descending, then value. */
const toBreakdownRows = (
  groups: BreakdownGroup<string>[],
  values: Readonly<Record<string, { readonly value: string }>>,
): BreakdownRow[] =>
  groups
    .map((group) => ({ ...group, value: enumNameOf(values, group.value) }))
    .sort((a, b) => b.currentSampleCount - a.currentSampleCount || a.value.localeCompare(b.value));

export const IncidentType = builder.objectRef<IncidentRow>("Incident").implement({
  description: "Something the detector decided a human should look at: a vitals regression or a failing health check.",
  fields: (t) => ({
    id: t.exposeID("id"),
    siteId: t.exposeID("siteId"),
    source: t.field({ type: IncidentSourceEnum, resolve: (incident) => incident.source }),
    subject: t.exposeString("subject", {
      description: "The path for a vitals regression, the check id for a health check.",
    }),
    metric: t.field({
      type: MetricNameEnum,
      nullable: true,
      description: "The regressed metric; null for a health-check incident.",
      resolve: (incident) => incident.metric,
    }),
    status: t.field({ type: IncidentStatusEnum, resolve: (incident) => incident.status }),
    detectedAt: t.field({ type: "DateTime", resolve: (incident) => incident.detectedAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (incident) => incident.updatedAt }),
    resolvedAt: t.field({ type: "DateTime", nullable: true, resolve: (incident) => incident.resolvedAt }),
    note: t.exposeString("note", { nullable: true, description: "What the human wrote when approving or dismissing." }),
    vitalsEvidence: t.field({
      type: VitalsEvidenceType,
      nullable: true,
      description: "Set when `source` is WEB_VITALS.",
      resolve: (incident) => (incident.evidence.kind === "web-vitals" ? incident.evidence : null),
    }),
    checkEvidence: t.field({
      type: CheckEvidenceType,
      nullable: true,
      description: "Set when `source` is HEALTH_CHECK.",
      resolve: (incident) => (incident.evidence.kind === "health-check" ? incident.evidence : null),
    }),
    breakdown: t.field({
      type: IncidentBreakdownType,
      nullable: true,
      description:
        "Per device class and connection type, over the two windows frozen in the evidence; null for health-check incidents. Two statements per incident, so ask for it on the detail view, not the list.",
      resolve: (incident, _args, ctx) => {
        if (incident.evidence.kind !== "web-vitals") {
          return null;
        }
        const data = loadIncidentBreakdown({ db: ctx.db, siteId: incident.siteId, evidence: incident.evidence });
        return {
          byDevice: toBreakdownRows(data.byDevice, DEVICE_CLASS_ENUM_VALUES),
          byConnection: toBreakdownRows(data.byConnection, CONNECTION_TYPE_ENUM_VALUES),
        };
      },
    }),
    steps: t.field({
      type: [IncidentStepType],
      description: "Who did what, oldest first; empty until an agent or a human acts. One statement per incident, so ask for it on the detail view, not the list.",
      resolve: (incident, _args, ctx) => listStepsForIncident({ db: ctx.db, incidentId: incident.id }),
    }),
  }),
});

export const DetectionResultType = builder.objectRef<DetectionResult>("DetectionResult").implement({
  description: "What one detector run did. Running it again on the same data reports everything as unchanged.",
  fields: (t) => ({
    opened: t.exposeInt("opened"),
    resolved: t.exposeInt("resolved"),
    unchanged: t.exposeInt("unchanged", {
      description: "Findings that already had a live incident, plus live incidents still backed by a finding.",
    }),
  }),
});
