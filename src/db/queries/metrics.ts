// Percentile and rating-bucket aggregates computed in SQL. SQLite has no
// percentile function, so a window function ranks every value within its
// (site, path, metric) group and the nearest-rank percentile is the value at
// rank ceil(p * n). One statement serves any number of sites and paths, which
// is what lets a DataLoader batch Page.metrics across a whole query.
import { sql, type SQL } from "drizzle-orm";
import type { MetricName } from "@/vitals/metrics";
import type { Db } from "../index";

/** Half-open: events with from <= recordedAt < to. Null means unbounded. */
export interface TimeRange {
  from: number | null;
  to: number | null;
}

export interface MetricSummaryRow {
  siteId: string;
  /** Null when the row is a site-wide rollup. */
  path: string | null;
  name: MetricName;
  sampleCount: number;
  p50: number;
  p75: number;
  p90: number;
  good: number;
  needsImprovement: number;
  poor: number;
}

/** ceil(percent% of n) with integer arithmetic, which SQLite lacks a CEIL for. */
const nearestRank = (percent: number): SQL => sql.raw(`(sample_count * ${percent} + 99) / 100`);

const inList = (values: readonly string[]): SQL => sql.join(values.map((value) => sql`${value}`), sql`, `);

const summarise = ({
  db,
  siteIds,
  paths,
  range,
}: {
  db: Db;
  siteIds: readonly string[];
  /** Null groups the whole site into one row per metric. */
  paths: readonly string[] | null;
  range: TimeRange;
}): MetricSummaryRow[] => {
  if (siteIds.length === 0 || paths?.length === 0) {
    return [];
  }
  const from = range.from ?? 0;
  const to = range.to ?? Number.MAX_SAFE_INTEGER;
  const pathColumn = paths === null ? sql`NULL` : sql`pv.path`;
  const pathFilter = paths === null ? sql`` : sql`AND pv.path IN (${inList(paths)})`;

  return db.all<MetricSummaryRow>(sql`
    WITH ranked AS (
      SELECT
        s.site_id AS site_id,
        ${pathColumn} AS path,
        me.name AS name,
        me.value AS value,
        me.rating AS rating,
        ROW_NUMBER() OVER (PARTITION BY s.site_id, ${pathColumn}, me.name ORDER BY me.value) AS rank,
        COUNT(*) OVER (PARTITION BY s.site_id, ${pathColumn}, me.name) AS sample_count
      FROM metric_events me
      JOIN pageviews pv ON pv.id = me.pageview_id
      JOIN sessions s ON s.id = pv.session_id
      WHERE s.site_id IN (${inList(siteIds)})
        ${pathFilter}
        AND me.recorded_at >= ${from}
        AND me.recorded_at < ${to}
    )
    SELECT
      site_id AS siteId,
      path,
      name,
      sample_count AS sampleCount,
      MAX(CASE WHEN rank = ${nearestRank(50)} THEN value END) AS p50,
      MAX(CASE WHEN rank = ${nearestRank(75)} THEN value END) AS p75,
      MAX(CASE WHEN rank = ${nearestRank(90)} THEN value END) AS p90,
      SUM(rating = 'good') AS good,
      SUM(rating = 'needs-improvement') AS needsImprovement,
      SUM(rating = 'poor') AS poor
    FROM ranked
    GROUP BY site_id, path, name
    ORDER BY site_id, path, name
  `);
};

export const loadPageMetrics = ({
  db,
  siteIds,
  paths,
  range,
}: {
  db: Db;
  siteIds: readonly string[];
  paths: readonly string[];
  range: TimeRange;
}): MetricSummaryRow[] => summarise({ db, siteIds, paths, range });

export const loadSiteMetrics = ({
  db,
  siteIds,
  range,
}: {
  db: Db;
  siteIds: readonly string[];
  range: TimeRange;
}): MetricSummaryRow[] => summarise({ db, siteIds, paths: null, range });
