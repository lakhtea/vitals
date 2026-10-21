// MetricSeries and SeriesPoint: p75 per time bucket, one series per metric.
// The SQL returns only buckets that had samples; the grouping here guarantees
// every metric appears, in METRIC_NAMES order, so a chart can lay out five
// panels without checking which ones came back.
import type { Db } from "@/db";
import type { TrafficFilter } from "@/db/queries/filter";
import { loadSeries, type SeriesRow } from "@/db/queries/series";
import { METRIC_NAMES, type MetricName } from "@/vitals/metrics";
import { SERIES_BUCKET_MS, type SeriesBucket } from "@/vitals/series";
import { builder } from "../builder";
import { MetricNameEnum } from "../enums";

interface SeriesPoint {
  from: number;
  p75: number;
  sampleCount: number;
}

interface MetricSeries {
  name: MetricName;
  points: SeriesPoint[];
}

const SeriesPointType = builder.objectRef<SeriesPoint>("SeriesPoint").implement({
  description: "One bucket of a time series.",
  fields: (t) => ({
    from: t.field({ type: "DateTime", description: "Start of the bucket.", resolve: (point) => point.from }),
    p75: t.exposeFloat("p75"),
    sampleCount: t.exposeInt("sampleCount"),
  }),
});

export const MetricSeriesType = builder.objectRef<MetricSeries>("MetricSeries").implement({
  description: "One metric's p75 over time.",
  fields: (t) => ({
    name: t.field({ type: MetricNameEnum, resolve: (series) => series.name }),
    points: t.field({
      type: [SeriesPointType],
      description: "Buckets with at least one sample, oldest first; empty buckets are omitted.",
      resolve: (series) => series.points,
    }),
  }),
});

/** Every metric in METRIC_NAMES order; a metric with no samples has an empty points list. */
const toMetricSeries = (rows: readonly SeriesRow[]): MetricSeries[] =>
  METRIC_NAMES.map((name) => ({
    name,
    points: rows
      .filter((row) => row.name === name)
      .map((row) => ({ from: row.bucketStart, p75: row.p75, sampleCount: row.sampleCount })),
  }));

/** One statement for all five metrics, for the site (path null) or one path. */
export const resolveMetricSeries = ({
  db,
  siteId,
  path,
  filter,
  bucket,
}: {
  db: Db;
  siteId: string;
  path: string | null;
  filter: TrafficFilter;
  bucket: SeriesBucket;
}): MetricSeries[] => toMetricSeries(loadSeries({ db, siteId, path, filter, bucketMs: SERIES_BUCKET_MS[bucket] }));
