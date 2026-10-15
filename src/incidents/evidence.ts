// What an incident stores about why it exists, as one JSON column. The shape
// is per source: a vitals regression carries the two windows it compared, a
// health-check incident carries the observation that tripped it. Written once
// by the detector, read by the dashboard and (from M13) by the agents.
import type { CheckStatus } from "@/checks/status";
import type { MetricName, MetricRating } from "@/vitals/metrics";

/** One aggregation window, half-open [from, to) in epoch ms. */
export interface WindowSummary {
  from: number;
  to: number;
  p75: number;
  sampleCount: number;
  rating: MetricRating;
}

export interface VitalsEvidence {
  kind: "web-vitals";
  path: string;
  metric: MetricName;
  baseline: WindowSummary;
  current: WindowSummary;
  /** (current.p75 - baseline.p75) / baseline.p75; 0.5 means half again as slow. */
  relativeIncrease: number;
}

export interface CheckEvidence {
  kind: "health-check";
  checkId: string;
  name: string;
  /** The status that tripped the detector, and the one observed before it. */
  status: CheckStatus;
  previousStatus: CheckStatus | null;
  /** How many observations in a row have been at `status`. */
  consecutive: number;
  value: number | null;
  unit: string | null;
  observedAt: number;
  detail: string | null;
}

export type IncidentEvidence = VitalsEvidence | CheckEvidence;
