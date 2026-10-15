// The detection rules as pure functions over plain data: no clock, no database.
// Given two aggregated windows it says which (path, metric) pairs regressed;
// given a check history it says which checks are tripping; given an open
// regression and the current window it says whether the page has recovered. detect.ts loads
// the inputs and persists the findings; this file is what chapter 12 explains
// and what the behaviour table in detector.test.ts pins.
import type { CheckStatus } from "@/checks/status";
import { METRIC_RATINGS, type MetricName, type MetricRating, rateMetric } from "@/vitals/metrics";
import type { CheckEvidence, IncidentEvidence, VitalsEvidence, WindowSummary } from "./evidence";
import type { IncidentSource } from "./vocabulary";

export interface DetectionRules {
  windowMs: number;
  minSampleCount: number;
  majorRelativeIncrease: number;
  minorRelativeIncrease: number;
  degradedStreakToOpen: number;
}

export const DETECTION_RULES = {
  /** Length of each comparison window; current = [now - windowMs, now), baseline = the window before it. */
  windowMs: 24 * 60 * 60 * 1000,
  /** Both windows need at least this many samples for a (path, metric) to be judged. */
  minSampleCount: 20,
  /** A p75 increase of this fraction fires on its own. */
  majorRelativeIncrease: 0.5,
  /**
   * A smaller increase fires only when the web.dev rating band also got worse.
   * Also the recovery tolerance: an open regression resolves once the current
   * p75 is within this fraction of the baseline frozen when it was detected.
   */
  minorRelativeIncrease: 0.2,
  /** DEGRADED must be observed this many times in a row before it opens an incident; FAILING opens on the first observation. */
  degradedStreakToOpen: 3,
} as const satisfies DetectionRules;

/** One (path, metric) aggregate inside a window, as the metrics query returns it. */
export interface WindowRow {
  path: string;
  metric: MetricName;
  p75: number;
  sampleCount: number;
}

/** Every (path, metric) aggregate of one site over a half-open [from, to) window. */
export interface MetricWindow {
  from: number;
  to: number;
  rows: ReadonlyArray<WindowRow>;
}

const pathMetricKey = ({ path, metric }: { path: string; metric: MetricName }): string => `${path}\u0000${metric}`;

const ratingSeverity = (rating: MetricRating): number => METRIC_RATINGS.indexOf(rating);

const summariseWindow = ({ window, row }: { window: MetricWindow; row: WindowRow }): WindowSummary => ({
  from: window.from,
  to: window.to,
  p75: row.p75,
  sampleCount: row.sampleCount,
  rating: rateMetric({ name: row.metric, value: row.p75 }),
});

/**
 * One finding per (path, metric) whose p75 got worse between the two windows.
 * Pairs missing from either window, or under the sample floor in either, are
 * not judged at all: too few samples make p75 a coin toss, not a measurement.
 */
export const findVitalsRegressions = ({
  baseline,
  current,
  rules,
}: {
  baseline: MetricWindow;
  current: MetricWindow;
  rules: DetectionRules;
}): VitalsEvidence[] => {
  const baselineByKey = new Map(baseline.rows.map((row) => [pathMetricKey(row), row]));

  return current.rows.flatMap((currentRow): VitalsEvidence[] => {
    const baselineRow = baselineByKey.get(pathMetricKey(currentRow));
    if (baselineRow === undefined) {
      return [];
    }
    if (baselineRow.sampleCount < rules.minSampleCount || currentRow.sampleCount < rules.minSampleCount) {
      return [];
    }
    // A zero baseline (a page whose CLS p75 is exactly 0) has no meaningful relative increase.
    if (baselineRow.p75 === 0) {
      return [];
    }

    const relativeIncrease = (currentRow.p75 - baselineRow.p75) / baselineRow.p75;
    const before = summariseWindow({ window: baseline, row: baselineRow });
    const after = summariseWindow({ window: current, row: currentRow });
    const hasBandWorsened = ratingSeverity(after.rating) > ratingSeverity(before.rating);
    const isMajor = relativeIncrease >= rules.majorRelativeIncrease;
    const isMinorWithWorseBand = hasBandWorsened && relativeIncrease >= rules.minorRelativeIncrease;
    if (!isMajor && !isMinorWithWorseBand) {
      return [];
    }

    return [
      {
        kind: "web-vitals",
        path: currentRow.path,
        metric: currentRow.metric,
        baseline: before,
        current: after,
        relativeIncrease,
      },
    ];
  });
};

/**
 * Whether an open vitals regression has recovered. It compares the current
 * window with the baseline frozen in the incident's evidence, not with the
 * rolling baseline: a regression that persists for two days fills the rolling
 * baseline with slow loads, the two-window comparison goes quiet, and the page
 * is still slow. Recovery needs evidence, so a current window under the sample
 * floor says nothing and the incident stays open for a person to close.
 */
export const hasVitalsRecovered = ({
  evidence,
  current,
  rules,
}: {
  evidence: VitalsEvidence;
  current: MetricWindow;
  rules: DetectionRules;
}): boolean => {
  const row = current.rows.find((candidate) => candidate.path === evidence.path && candidate.metric === evidence.metric);
  if (row === undefined || row.sampleCount < rules.minSampleCount) {
    return false;
  }
  return row.p75 <= evidence.baseline.p75 * (1 + rules.minorRelativeIncrease);
};

/** One pushed check result, as stored in the checks table. */
export interface CheckObservation {
  checkId: string;
  name: string;
  status: CheckStatus;
  value: number | null;
  unit: string | null;
  observedAt: number;
  detail: string | null;
}

const groupByCheck = (observations: ReadonlyArray<CheckObservation>): Map<string, CheckObservation[]> =>
  observations.reduce((groups, observation) => {
    groups.set(observation.checkId, [...(groups.get(observation.checkId) ?? []), observation]);
    return groups;
  }, new Map<string, CheckObservation[]>());

/** How many of the newest observations share the latest status; `history` is oldest first. */
const trailingStreakLength = (history: ReadonlyArray<CheckObservation>): number => {
  const latestStatus = history[history.length - 1].status;
  const firstDifferentFromEnd = [...history].reverse().findIndex((observation) => observation.status !== latestStatus);
  return firstDifferentFromEnd === -1 ? history.length : firstDifferentFromEnd;
};

/**
 * One finding per check whose latest observation is tripping: FAILING on the
 * first observation, DEGRADED only once it has held for `degradedStreakToOpen`
 * observations in a row. Observations may arrive in any order.
 */
export const findCheckFailures = ({
  observations,
  rules,
}: {
  observations: ReadonlyArray<CheckObservation>;
  rules: DetectionRules;
}): CheckEvidence[] =>
  [...groupByCheck(observations).entries()]
    .sort(([checkIdA], [checkIdB]) => checkIdA.localeCompare(checkIdB))
    .flatMap(([, unsorted]): CheckEvidence[] => {
      const history = [...unsorted].sort((a, b) => a.observedAt - b.observedAt);
      const latest = history[history.length - 1];
      const consecutive = trailingStreakLength(history);
      const isTripping =
        latest.status === "failing" || (latest.status === "degraded" && consecutive >= rules.degradedStreakToOpen);
      if (!isTripping) {
        return [];
      }
      const beforeStreak = history[history.length - consecutive - 1];
      return [
        {
          kind: "health-check",
          checkId: latest.checkId,
          name: latest.name,
          status: latest.status,
          previousStatus: beforeStreak === undefined ? null : beforeStreak.status,
          consecutive,
          value: latest.value,
          unit: latest.unit,
          observedAt: latest.observedAt,
          detail: latest.detail,
        },
      ];
    });

/** The (source, subject, metric) triple an incident is "about"; one live incident exists per triple. */
export interface IncidentIdentity {
  source: IncidentSource;
  subject: string;
  metric: MetricName | null;
}

export const incidentIdentity = (evidence: IncidentEvidence): IncidentIdentity => {
  if (evidence.kind === "web-vitals") {
    return { source: "web-vitals", subject: evidence.path, metric: evidence.metric };
  }
  return { source: "health-check", subject: evidence.checkId, metric: null };
};

/** Stable string of an identity, for maps and sets. */
export const incidentIdentityKey = ({ source, subject, metric }: IncidentIdentity): string =>
  [source, subject, metric ?? ""].join("\u0000");
