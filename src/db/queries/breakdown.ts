// Splits one path's traffic by who was affected, per device class and per
// connection type. Two shapes: a vitals incident's two evidence windows (the
// p75 and sample count in the baseline and in the current window) and a page
// under a traffic filter (a full MetricSummary per metric). One statement per
// dimension, using the same nearest-rank window-function technique as metrics.ts.
import { sql } from "drizzle-orm";
import type { VitalsEvidence } from "@/incidents/evidence";
import { CONNECTION_TYPES, DEVICE_CLASSES, type ConnectionType, type DeviceClass } from "@/vitals/dimensions";
import type { Db } from "../index";
import { sessionDimensionSql, type TrafficFilter } from "./filter";
import { type MetricSummaryRow, nearestRank, summaryColumnsSql } from "./metrics";

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

/** One dimension value of a page's traffic with a summary per metric that had samples there. */
export interface DimensionSlice<Value extends string> {
  /** The database spelling, e.g. "mobile" or "4g". */
  value: Value;
  metrics: MetricSummaryRow[];
}

export interface PageBreakdownData {
  byDevice: DimensionSlice<DeviceClass>[];
  byConnection: DimensionSlice<ConnectionType>[];
}

interface DimensionSummaryRow extends MetricSummaryRow {
  dimensionValue: string;
}

const loadDimensionSummaries = ({
  db,
  siteId,
  path,
  filter,
  dimension,
}: {
  db: Db;
  siteId: string;
  path: string;
  filter: TrafficFilter;
  dimension: keyof typeof DIMENSION_COLUMNS;
}): DimensionSummaryRow[] => {
  const column = sql.raw(`s.${DIMENSION_COLUMNS[dimension]}`);
  const from = filter.from ?? 0;
  const to = filter.to ?? Number.MAX_SAFE_INTEGER;
  // The same scope as Page.metrics, partitioned additionally by the dimension
  // column, so each slice's percentiles are what Page.metrics would report
  // with that dimension in the filter.
  return db.all<DimensionSummaryRow>(sql`
    WITH ranked AS (
      SELECT
        ${column} AS dimension_value,
        s.site_id AS site_id,
        pv.path AS path,
        me.name AS name,
        me.value AS value,
        me.rating AS rating,
        ROW_NUMBER() OVER (PARTITION BY ${column}, me.name ORDER BY me.value) AS rank,
        COUNT(*) OVER (PARTITION BY ${column}, me.name) AS sample_count
      FROM metric_events me
      JOIN pageviews pv ON pv.id = me.pageview_id
      JOIN sessions s ON s.id = pv.session_id
      WHERE s.site_id = ${siteId}
        AND pv.path = ${path}
        AND pv.started_at >= ${from}
        AND pv.started_at < ${to}
        ${sessionDimensionSql(filter)}
    )
    SELECT
      dimension_value AS dimensionValue,
      site_id AS siteId,
      path,
      name,
      ${summaryColumnsSql()}
    FROM ranked
    GROUP BY dimension_value, site_id, path, name
    ORDER BY dimension_value, name
  `);
};

/** One slice per vocabulary value, in vocabulary order, dropping values that had no samples. */
const toSlices = <Value extends string>(
  rows: DimensionSummaryRow[],
  values: readonly Value[],
): DimensionSlice<Value>[] =>
  values
    .map((value) => ({ value, metrics: rows.filter((row) => row.dimensionValue === value) }))
    .filter((slice) => slice.metrics.length > 0);

/** Two statements: one per dimension. Slices come back in the vocabulary's order, which is also the dashboard's. */
export const loadPageBreakdown = ({
  db,
  siteId,
  path,
  filter,
}: {
  db: Db;
  siteId: string;
  path: string;
  filter: TrafficFilter;
}): PageBreakdownData => ({
  byDevice: toSlices(loadDimensionSummaries({ db, siteId, path, filter, dimension: "device" }), DEVICE_CLASSES),
  byConnection: toSlices(
    loadDimensionSummaries({ db, siteId, path, filter, dimension: "connection" }),
    CONNECTION_TYPES,
  ),
});

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
