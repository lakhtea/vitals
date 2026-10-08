// One headline number per metric: the p75 and its web.dev rating. The card is
// the dashboard's answer to "is this metric OK?", so color never stands alone:
// the pill spells the rating out.
import type { ReactElement } from "react";
import { formatMetricValue, metricLabel, ratingLabel, thresholdHint } from "@/vitals/format";
import type { MetricName, MetricRating } from "@/vitals/metrics";
import styles from "./MetricCard.module.css";

export interface MetricCardProps {
  name: MetricName;
  p75: number | null;
  rating: MetricRating | null;
  sampleCount: number;
}

const numberFormat = new Intl.NumberFormat("en-US");

const formatSampleCount = (count: number): string =>
  `${numberFormat.format(count)} ${count === 1 ? "sample" : "samples"}`;

export const MetricCard = ({ name, p75, rating, sampleCount }: MetricCardProps): ReactElement => {
  const summary = p75 !== null && rating !== null ? { p75, rating } : null;

  return (
    <article className={styles.card} data-rating={summary === null ? "none" : summary.rating}>
      <header className={styles.heading}>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.label}>{metricLabel(name)}</p>
      </header>
      <p className={styles.value}>{summary === null ? "–" : formatMetricValue({ name, value: summary.p75 })}</p>
      <p className={styles.pill}>{summary === null ? "No data" : ratingLabel(summary.rating)}</p>
      <p className={styles.meta}>
        {formatSampleCount(sampleCount)} · {thresholdHint(name)}
      </p>
    </article>
  );
};
