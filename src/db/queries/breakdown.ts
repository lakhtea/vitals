// Splits a vitals incident's two evidence windows by who was affected: per
// device class and per connection type, the p75 and sample count in the
// baseline and in the current window. One statement per dimension, using the
// same nearest-rank window-function technique as metrics.ts.
import { sql } from "drizzle-orm";
import type { VitalsEvidence } from "@/incidents/evidence";
import type { ConnectionType, DeviceClass } from "@/vitals/dimensions";
import type { Db } from "../index";
import { nearestRank } from "./metrics";

export interface BreakdownGroup<Value extends string> {
  /** The database spelling, e.g. "mobile" or "4g". */
  value: Value;
  /** Null when the group has no samples in that window. */
  baselineP75: number | null;
  baselineSampleCount: number;
  currentP75: number | null;
  currentSampleCount: number;
}

export interface IncidentBreakdownData {
  byDevice: BreakdownGroup<DeviceClass>[];
  byConnection: BreakdownGroup<ConnectionType>[];
}

/** The session columns a breakdown can group by; never user input, so safe to splice in raw. */
const DIMENSION_COLUMNS = { device: "device_class", connection: "connection_type" } as const;

interface WindowGroupRow {
  period: "baseline" | "current";
  value: string;
  sampleCount: number;
  p75: number;
}

const loadWindowGroups = ({
  db,
  siteId,
  evidence,
  dimension,
}: {
  db: Db;
  siteId: string;
  evidence: VitalsEvidence;
  dimension: keyof typeof DIMENSION_COLUMNS;
}): WindowGroupRow[] => {
  const column = sql.raw(`s.${DIMENSION_COLUMNS[dimension]}`);
  // The same scope the detector measured (site, path, metric, pageview start
  // inside the window), once per window. UNION ALL rather than a CASE so a
  // sample would count in both windows if they ever overlapped.
  const inWindow = ({ from, to }: { from: number; to: number }) => sql`
    SELECT ${column} AS value, me.value AS sample
    FROM metric_events me
    JOIN pageviews pv ON pv.id = me.pageview_id
    JOIN sessions s ON s.id = pv.session_id
    WHERE s.site_id = ${siteId}
      AND pv.path = ${evidence.path}
      AND me.name = ${evidence.metric}
      AND pv.started_at >= ${from}
      AND pv.started_at < ${to}
  `;

  return db.all<WindowGroupRow>(sql`
    WITH scoped AS (
      SELECT 'baseline' AS period, value, sample FROM (${inWindow(evidence.baseline)})
      UNION ALL
      SELECT 'current' AS period, value, sample FROM (${inWindow(evidence.current)})
    ),
    ranked AS (
      SELECT
        period,
        value,
        sample,
        ROW_NUMBER() OVER (PARTITION BY period, value ORDER BY sample) AS rank,
        COUNT(*) OVER (PARTITION BY period, value) AS sample_count
      FROM scoped
    )
    SELECT
      period,
      value,
      sample_count AS sampleCount,
      MAX(CASE WHEN rank = ${nearestRank(75)} THEN sample END) AS p75
    FROM ranked
    GROUP BY period, value
    ORDER BY value, period
  `);
};

/** Folds the per-window rows into one row per group; a group seen in only one window reads null and 0 for the other. */
const toGroups = <Value extends string>(rows: WindowGroupRow[]): BreakdownGroup<Value>[] => {
  const groups = new Map<string, BreakdownGroup<Value>>();
  for (const row of rows) {
    const group = groups.get(row.value) ?? {
      value: row.value as Value,
      baselineP75: null,
      baselineSampleCount: 0,
      currentP75: null,
      currentSampleCount: 0,
    };
    if (row.period === "baseline") {
      group.baselineP75 = row.p75;
      group.baselineSampleCount = row.sampleCount;
    } else {
      group.currentP75 = row.p75;
      group.currentSampleCount = row.sampleCount;
    }
    groups.set(row.value, group);
  }
  return [...groups.values()];
};

/** Two statements: one per dimension. Rows are unordered; the caller orders by its display spelling. */
export const loadIncidentBreakdown = ({
  db,
  siteId,
  evidence,
}: {
  db: Db;
  siteId: string;
  evidence: VitalsEvidence;
}): IncidentBreakdownData => ({
  byDevice: toGroups<DeviceClass>(loadWindowGroups({ db, siteId, evidence, dimension: "device" })),
  byConnection: toGroups<ConnectionType>(loadWindowGroups({ db, siteId, evidence, dimension: "connection" })),
});
