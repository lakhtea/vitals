// Human-readable metric values and names: the one place the dashboard decides
// that 2600 ms reads as "2.6 s", a CLS of 0.1 reads as "0.10", a rating is
// spelled "Needs improvement", and 1204 samples read as "1,204 samples".
import { METRIC_THRESHOLDS, type MetricName, type MetricRating } from "./metrics";

const MILLISECONDS_PER_SECOND = 1000;
const CLS_DECIMALS = 2;
const SECONDS_DECIMALS = 1;

export const formatMetricValue = ({ name, value }: { name: MetricName; value: number }): string => {
  if (name === "CLS") {
    return value.toFixed(CLS_DECIMALS);
  }
  const wholeMilliseconds = Math.round(value);
  if (wholeMilliseconds >= MILLISECONDS_PER_SECOND) {
    return `${(value / MILLISECONDS_PER_SECOND).toFixed(SECONDS_DECIMALS)} s`;
  }
  return `${wholeMilliseconds} ms`;
};

const sampleCountFormat = new Intl.NumberFormat("en-US");

/** Always with its unit ("1 sample", "1,204 samples"), so a bare count never reads as a metric value. */
export const formatSampleCount = (count: number): string =>
  `${sampleCountFormat.format(count)} ${count === 1 ? "sample" : "samples"}`;

const METRIC_LABELS: Record<MetricName, string> = {
  LCP: "Largest Contentful Paint",
  CLS: "Cumulative Layout Shift",
  INP: "Interaction to Next Paint",
  TTFB: "Time to First Byte",
  FCP: "First Contentful Paint",
};

export const metricLabel = (name: MetricName): string => METRIC_LABELS[name];

const RATING_LABELS: Record<MetricRating, string> = {
  good: "Good",
  "needs-improvement": "Needs improvement",
  poor: "Poor",
};

export const ratingLabel = (rating: MetricRating): string => RATING_LABELS[rating];

/** The "good" edge of the metric's web.dev scale, e.g. "good ≤ 2.5 s". */
export const thresholdHint = (name: MetricName): string => {
  const [goodUpTo] = METRIC_THRESHOLDS[name];
  return `good ≤ ${formatMetricValue({ name, value: goodUpTo })}`;
};
