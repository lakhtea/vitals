// MetricSummary: one metric's percentiles and rating buckets for a page or a
// site. Backed directly by the SQL row so no mapping layer can drift from it;
// the p75 rating is derived here because web.dev rates the p75, not the mean.
import type { MetricSummaryRow } from "@/db/queries/metrics";
import { rateMetric } from "@/vitals/metrics";
import { builder } from "../builder";
import { MetricNameEnum, MetricRatingEnum } from "../enums";

const RatingBucketsType = builder.objectRef<MetricSummaryRow>("RatingBuckets").implement({
  description: "How many samples fell in each web.dev rating band.",
  fields: (t) => ({
    good: t.exposeInt("good"),
    needsImprovement: t.exposeInt("needsImprovement"),
    poor: t.exposeInt("poor"),
  }),
});

export const MetricSummaryType = builder.objectRef<MetricSummaryRow>("MetricSummary").implement({
  description: "Percentiles and rating buckets for one metric over a set of pageviews.",
  fields: (t) => ({
    name: t.field({ type: MetricNameEnum, resolve: (row) => row.name }),
    sampleCount: t.exposeInt("sampleCount"),
    p50: t.exposeFloat("p50"),
    p75: t.exposeFloat("p75", { description: "The headline number, per web.dev." }),
    p90: t.exposeFloat("p90"),
    p75Rating: t.field({
      type: MetricRatingEnum,
      resolve: (row) => rateMetric({ name: row.name, value: row.p75 }),
    }),
    buckets: t.field({ type: RatingBucketsType, resolve: (row) => row }),
  }),
});
