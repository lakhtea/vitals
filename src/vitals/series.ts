// The bucket sizes a time series can be rolled up into, and their widths in
// epoch milliseconds. Both the GraphQL enum and the SQL bucketing read from
// here, so a bucket cannot mean one thing on the wire and another in the query.
export const SERIES_BUCKETS = ["hour", "six-hours", "day"] as const;
export type SeriesBucket = (typeof SERIES_BUCKETS)[number];

const MS_PER_HOUR = 60 * 60 * 1000;

export const SERIES_BUCKET_MS: Record<SeriesBucket, number> = {
  hour: MS_PER_HOUR,
  "six-hours": 6 * MS_PER_HOUR,
  day: 24 * MS_PER_HOUR,
};
