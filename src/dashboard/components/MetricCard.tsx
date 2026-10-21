// One headline number per metric: the p75, its web.dev rating, and the recent
// shape of the series as a sparkline. The card is the dashboard's answer to
// "is this metric OK?", so colour never stands alone: the pill spells the
// rating out and the sparkline only borrows the pill's colour.
import type { ReactElement } from "react";
import { formatMetricValue, formatSampleCount, metricLabel, ratingLabel, thresholdHint } from "@/vitals/format";
import type { MetricName, MetricRating } from "@/vitals/metrics";
import type { ChartPoint } from "../chartScale";
import styles from "./MetricCard.module.css";
import { Sparkline } from "./Sparkline";
import { StatusPill } from "./StatusPill";

export interface MetricCardProps {
  name: MetricName;
  p75: number | null;
  rating: MetricRating | null;
  sampleCount: number;
  /** The metric's p75 per bucket over the chosen range; omitted or short, the card leaves the sparkline's row blank. */
  points?: readonly ChartPoint[];
}

const SPARKLINE_WIDTH = 160;
const SPARKLINE_HEIGHT = 36;

export const MetricCard = ({ name, p75, rating, sampleCount, points = [] }: MetricCardProps): ReactElement => {
  const summary = p75 !== null && rating !== null ? { p75, rating } : null;

  return (
    <article className={styles.card} data-rating={summary === null ? "none" : summary.rating}>
      <header className={styles.heading}>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.label}>{metricLabel(name)}</p>
      </header>
      <div className={styles.figure}>
        <p className={styles.value}>{summary === null ? "–" : formatMetricValue({ name, value: summary.p75 })}</p>
        <StatusPill tone={summary === null ? null : summary.rating}>
          {summary === null ? "No data" : ratingLabel(summary.rating)}
        </StatusPill>
      </div>
      {/* The row keeps its height when there is nothing to draw, so five cards stay level. */}
      <div className={styles.sparkline}>
        <Sparkline points={points} width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT} />
      </div>
      {/* Each half stays whole, so a narrow card breaks between them and never inside "2.5 s". */}
      <p className={styles.meta}>
        <span className={styles.metaPart}>{formatSampleCount(sampleCount)} ·</span>{" "}
        <span className={styles.metaPart}>{thresholdHint(name)}</span>
      </p>
    </article>
  );
};
