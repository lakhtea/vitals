// Translates GraphQL enum values (NEEDS_IMPROVEMENT, LCP) into the domain
// unions the components speak ("needs-improvement", "LCP"), so components stay
// ignorant of GraphQL and the schema's enum naming rules stay in the schema.
import type { MetricName as GqlMetricName, MetricRating as GqlMetricRating } from "@/graphql/generated/graphql";
import type { MetricName, MetricRating } from "@/vitals/metrics";

const RATING_FROM_GRAPHQL: Record<GqlMetricRating, MetricRating> = {
  GOOD: "good",
  NEEDS_IMPROVEMENT: "needs-improvement",
  POOR: "poor",
};

const NAME_FROM_GRAPHQL: Record<GqlMetricName, MetricName> = {
  LCP: "LCP",
  CLS: "CLS",
  INP: "INP",
  TTFB: "TTFB",
  FCP: "FCP",
};

export const toMetricRating = (rating: GqlMetricRating): MetricRating => RATING_FROM_GRAPHQL[rating];

export const toMetricName = (name: GqlMetricName): MetricName => NAME_FROM_GRAPHQL[name];
