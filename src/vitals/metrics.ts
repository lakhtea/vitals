// The vocabulary of a metric event: which metrics exist, their web.dev
// thresholds (read from the web-vitals package, never hand-copied), and the one
// function that turns a value into a good / needs-improvement / poor rating.
import {
  CLSThresholds,
  FCPThresholds,
  INPThresholds,
  LCPThresholds,
  TTFBThresholds,
  type MetricRatingThresholds,
} from "web-vitals";

export const METRIC_NAMES = ["LCP", "CLS", "INP", "TTFB", "FCP"] as const;
export type MetricName = (typeof METRIC_NAMES)[number];

export const METRIC_RATINGS = ["good", "needs-improvement", "poor"] as const;
export type MetricRating = (typeof METRIC_RATINGS)[number];

/** [goodUpTo, needsImprovementUpTo]; both edges inclusive, per web.dev. */
export const METRIC_THRESHOLDS: Record<MetricName, MetricRatingThresholds> = {
  LCP: LCPThresholds,
  CLS: CLSThresholds,
  INP: INPThresholds,
  TTFB: TTFBThresholds,
  FCP: FCPThresholds,
};

/**
 * Upper bounds on values the ingest endpoint will believe. Anything above is a
 * broken clock or a bug, not a user experience: a minute-long LCP or a CLS of
 * 10 would only poison the percentiles.
 */
export const MAX_PLAUSIBLE_VALUE: Record<MetricName, number> = {
  LCP: 60_000,
  CLS: 10,
  INP: 60_000,
  TTFB: 60_000,
  FCP: 60_000,
};

export const rateMetric = ({ name, value }: { name: MetricName; value: number }): MetricRating => {
  const [goodUpTo, needsImprovementUpTo] = METRIC_THRESHOLDS[name];
  if (value <= goodUpTo) {
    return "good";
  }
  if (value <= needsImprovementUpTo) {
    return "needs-improvement";
  }
  return "poor";
};
