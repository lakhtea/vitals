// The dashboard's own Core Web Vitals, all time: proof that it reports into
// itself through the same library and endpoint as any other site, shown in the
// same five cards as any site's. A leaf with no hooks, so the Server Component
// can render it complete in the first HTML.
import type { ReactElement } from "react";
import { METRIC_NAMES, type MetricName, type MetricRating } from "@/vitals/metrics";
import { EmptyState } from "./EmptyState";
import { MetricCard } from "./MetricCard";
import { SectionHeader } from "./SectionHeader";
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

const SelfMeasuredCard = ({ name, metric }: { name: MetricName; metric: SelfMeasuredMetric | null }): ReactElement => {
  if (metric === null) {
    return <MetricCard name={name} p75={null} rating={null} sampleCount={0} />;
  }
  return <MetricCard name={name} p75={metric.p75} rating={metric.rating} sampleCount={metric.sampleCount} />;
};

export const SelfMeasurementPanel = ({ metrics }: SelfMeasurementPanelProps): ReactElement => {
  const isEmpty = !metrics.some(hasSamples);

  return (
    <section className={styles.panel}>
      <SectionHeader
        title="This site, measured by itself"
        description="The dashboard reports its own Core Web Vitals through the same library and endpoint as any other site."
      />
      {isEmpty ? (
        <EmptyState icon="sessions" title="No sessions recorded yet">
          Wire the browser library (<code>docs/learning/03-library-brief.md</code>, acceptance criterion 10) and this
          fills in.
        </EmptyState>
      ) : (
        <div className={styles.cards}>
          {METRIC_NAMES.map((name) => (
            <SelfMeasuredCard key={name} name={name} metric={metrics.find((metric) => metric.name === name) ?? null} />
          ))}
        </div>
      )}
    </section>
  );
};
