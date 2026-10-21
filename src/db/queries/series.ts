// p75 per time bucket per metric, for a whole site or one of its paths: the
// rows behind the dashboard's chart and sparklines. The same nearest-rank window
// function as metrics.ts, partitioned additionally by the bucket a pageview
// started in, so one statement answers every metric and every bucket at once.
import { sql } from "drizzle-orm";
import type { MetricName } from "@/vitals/metrics";
import type { Db } from "../index";
import { sessionDimensionSql, type TrafficFilter } from "./filter";
import { nearestRank } from "./metrics";

export interface SeriesRow {
  name: MetricName;
  /** Start of the bucket, epoch ms; a multiple of the bucket width. */
  bucketStart: number;
  p75: number;
  sampleCount: number;
}

/** Only buckets with at least one sample come back, ordered by metric name then bucket start. */
export const loadSeries = ({
  db,
  siteId,
  path,
  filter,
  bucketMs,
}: {
  db: Db;
  siteId: string;
  /** Null rolls the whole site up; a path narrows to its pageviews. */
  path: string | null;
  filter: TrafficFilter;
  bucketMs: number;
}): SeriesRow[] => {
  if (!Number.isInteger(bucketMs) || bucketMs <= 0) {
    throw new Error(`bucketMs must be a positive integer (got ${bucketMs})`);
  }
  const from = filter.from ?? 0;
  const to = filter.to ?? Number.MAX_SAFE_INTEGER;
  const pathFilter = path === null ? sql`` : sql`AND pv.path = ${path}`;
  // Spliced as a literal so SQLite sees integer / integer, which floors: a
  // bound parameter could arrive as a REAL and turn the division exact.
  const bucket = sql.raw(String(bucketMs));

  return db.all<SeriesRow>(sql`
    WITH bucketed AS (
      SELECT
        me.name AS name,
        me.value AS value,
        (pv.started_at / ${bucket}) * ${bucket} AS bucket_start
      FROM metric_events me
      JOIN pageviews pv ON pv.id = me.pageview_id
      JOIN sessions s ON s.id = pv.session_id
      WHERE s.site_id = ${siteId}
        ${pathFilter}
        AND pv.started_at >= ${from}
        AND pv.started_at < ${to}
        ${sessionDimensionSql(filter)}
    ),
    ranked AS (
      SELECT
        name,
        value,
        bucket_start,
        ROW_NUMBER() OVER (PARTITION BY name, bucket_start ORDER BY value) AS rank,
        COUNT(*) OVER (PARTITION BY name, bucket_start) AS sample_count
      FROM bucketed
    )
    SELECT
      name,
      bucket_start AS bucketStart,
      sample_count AS sampleCount,
      MAX(CASE WHEN rank = ${nearestRank(75)} THEN value END) AS p75
    FROM ranked
    GROUP BY name, bucket_start
    ORDER BY name, bucket_start
  `);
};
