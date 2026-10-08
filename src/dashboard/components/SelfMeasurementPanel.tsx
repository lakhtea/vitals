// The dashboard's own Core Web Vitals, all time: proof that it reports into
// itself through the same library and endpoint as any other site. A leaf with
// no hooks, so the Server Component can render it complete in the first HTML.
import type { ReactElement } from "react";
import { formatMetricValue, formatSampleCount, ratingLabel } from "@/vitals/format";
import { METRIC_NAMES, type MetricName, type MetricRating } from "@/vitals/metrics";
import styles from "./SelfMeasurementPanel.module.css";

export interface SelfMeasuredMetric {
  name: MetricName;
  p75: number;
  rating: MetricRating;
  sampleCount: number;
}

export interface SelfMeasurementPanelProps {
  /** The vitals-dashboard site's rollup; a metric nobody has reported yet is simply absent. */
  metrics: SelfMeasuredMetric[];
}

const hasSamples = (metric: SelfMeasuredMetric): boolean => metric.sampleCount > 0;

const MetricCell = ({ name, metric }: { name: MetricName; metric: SelfMeasuredMetric | null }): ReactElement => (
  <div className={styles.metric} data-rating={metric === null ? "none" : metric.rating}>
    <dt className={styles.name}>{name}</dt>
    <dd className={styles.value}>{metric === null ? "–" : formatMetricValue({ name, value: metric.p75 })}</dd>
    <dd className={styles.rating}>{metric === null ? "No data" : ratingLabel(metric.rating)}</dd>
    <dd className={styles.samples}>{formatSampleCount(metric === null ? 0 : metric.sampleCount)}</dd>
  </div>
);

export const SelfMeasurementPanel = ({ metrics }: SelfMeasurementPanelProps): ReactElement => {
  const isEmpty = !metrics.some(hasSamples);

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>This site, measured by itself</h2>
      <p className={styles.explanation}>
        The dashboard reports its own Core Web Vitals through the same library and endpoint as any other site.
      </p>
      {isEmpty ? (
        <p className={styles.empty}>
          No sessions recorded yet. Wire the browser library (see <code>docs/learning/03-library-brief.md</code>,
          acceptance criterion 10) and this fills in.
        </p>
      ) : (
        <dl className={styles.metrics}>
          {METRIC_NAMES.map((name) => (
            <MetricCell key={name} name={name} metric={metrics.find((metric) => metric.name === name) ?? null} />
          ))}
        </dl>
      )}
    </section>
  );
};
