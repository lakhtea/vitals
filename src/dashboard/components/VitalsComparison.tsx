// The vitals evidence as a before/after: the baseline and current p75 as two
// large figures with the change between them, and under them a pair of bars
// on one scale whose track is painted in the metric's web.dev bands, so the
// reader sees which band each window sits in without reading a threshold.
// Server-rendered; the bars are drawn with percentage coordinates so one SVG
// fits any width without JavaScript.
import { useId, type ReactElement } from "react";
import type { VitalsEvidence, WindowSummary } from "@/incidents/evidence";
import { formatMetricValue, formatSampleCount, ratingLabel } from "@/vitals/format";
import { METRIC_THRESHOLDS, type MetricName, type MetricRating } from "@/vitals/metrics";
import { formatRelativeIncrease, type PillTone } from "../incidents";
import { StatusPill } from "./StatusPill";
import { Timestamp } from "./Timestamp";
import styles from "./VitalsComparison.module.css";

export interface VitalsComparisonProps {
  evidence: VitalsEvidence;
}

/** How much of the poor band stays visible when both windows are inside the good or needs-improvement band. */
const NEEDS_IMPROVEMENT_HEADROOM = 1.15;
const BAR_HEIGHT = 16;
const BAR_END_RADIUS = 4;
/** Past this point along the scale a tick's label hangs to its left, so the last label never leaves the bars. */
const LABEL_FLIP_PERCENT = 60;
const LABEL_OFFSET = 4;
const AXIS_HEIGHT = 44;
/** The two ticks' labels sit on two rows so they can never collide, however close the thresholds are. */
const GOOD_TICK = { lineEnd: 12, labelBaseline: 24 };
const POOR_TICK = { lineEnd: 30, labelBaseline: 42 };

interface Scale {
  max: number;
  goodUpTo: number;
  needsImprovementUpTo: number;
}

const scaleFor = ({ metric, baseline, current }: VitalsEvidence): Scale => {
  const [goodUpTo, needsImprovementUpTo] = METRIC_THRESHOLDS[metric];
  return {
    max: Math.max(baseline.p75, current.p75, needsImprovementUpTo * NEEDS_IMPROVEMENT_HEADROOM),
    goodUpTo,
    needsImprovementUpTo,
  };
};

const percentOf = (value: number, scale: Scale): number => Math.min(100, (value / scale.max) * 100);

const percent = (value: number): string => `${value.toFixed(2)}%`;

const changeTone = (relativeIncrease: number): PillTone => {
  if (relativeIncrease > 0) return "poor";
  if (relativeIncrease < 0) return "good";
  return null;
};

const Figure = ({
  label,
  metric,
  window,
}: {
  label: string;
  metric: MetricName;
  window: WindowSummary;
}): ReactElement => (
  <div className={styles.figure}>
    <dt className={styles.figureLabel}>{label}</dt>
    <dd className={styles.figureBody}>
      <span className={styles.figureValue}>{formatMetricValue({ name: metric, value: window.p75 })}</span>
      <span className={styles.figureMeta}>
        <StatusPill tone={window.rating}>{ratingLabel(window.rating)}</StatusPill>
        <span>{formatSampleCount(window.sampleCount)}</span>
      </span>
      <span className={styles.figureWindow}>
        <Timestamp value={window.from} /> to <Timestamp value={window.to} /> UTC
      </span>
    </dd>
  </div>
);

const Bar = ({ rating, value, scale }: { rating: MetricRating; value: number; scale: Scale }): ReactElement => {
  const fillClipId = useId();
  const goodEnd = percentOf(scale.goodUpTo, scale);
  const needsImprovementEnd = percentOf(scale.needsImprovementUpTo, scale);
  const filled = percentOf(value, scale);

  return (
    <svg className={styles.bar} width="100%" height={BAR_HEIGHT} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={fillClipId}>
          <rect x="0" y="0" width={percent(filled)} height={BAR_HEIGHT} />
        </clipPath>
      </defs>
      {/* The track is the metric's scale painted in its three bands. */}
      <rect className={styles.bandGood} x="0" y="0" width={percent(goodEnd)} height={BAR_HEIGHT} />
      <rect
        className={styles.bandNeedsImprovement}
        x={percent(goodEnd)}
        y="0"
        width={percent(needsImprovementEnd - goodEnd)}
        height={BAR_HEIGHT}
      />
      <rect
        className={styles.bandPoor}
        x={percent(needsImprovementEnd)}
        y="0"
        width={percent(100 - needsImprovementEnd)}
        height={BAR_HEIGHT}
      />
      {/* The value: rounded at its data end, square at the baseline. The square cap is clipped to
          the fill, so a zero or hairline value paints no stub wider than the value itself. */}
      <rect
        className={styles.fill}
        data-rating={rating}
        x="0"
        y="0"
        width={percent(filled)}
        height={BAR_HEIGHT}
        rx={BAR_END_RADIUS}
      />
      <rect
        className={styles.fill}
        data-rating={rating}
        x="0"
        y="0"
        width={BAR_END_RADIUS}
        height={BAR_HEIGHT}
        clipPath={`url(#${fillClipId})`}
      />
      {/* The band edges cut through the fill, so the thresholds stay visible inside a long bar. */}
      <line className={styles.cut} x1={percent(goodEnd)} x2={percent(goodEnd)} y1="0" y2={BAR_HEIGHT} />
      <line
        className={styles.cut}
        x1={percent(needsImprovementEnd)}
        x2={percent(needsImprovementEnd)}
        y1="0"
        y2={BAR_HEIGHT}
      />
    </svg>
  );
};

const TickLabel = ({
  at,
  baseline,
  children,
}: {
  at: number;
  baseline: number;
  children: string;
}): ReactElement => {
  const hangsLeft = at > LABEL_FLIP_PERCENT;
  return (
    <text
      className={styles.tickLabel}
      x={percent(at)}
      y={baseline}
      dx={hangsLeft ? -LABEL_OFFSET : LABEL_OFFSET}
      textAnchor={hangsLeft ? "end" : "start"}
    >
      {children}
    </text>
  );
};

const Axis = ({ metric, scale }: { metric: MetricName; scale: Scale }): ReactElement => {
  const goodAt = percentOf(scale.goodUpTo, scale);
  const poorAt = percentOf(scale.needsImprovementUpTo, scale);
  const good = formatMetricValue({ name: metric, value: scale.goodUpTo });
  const poor = formatMetricValue({ name: metric, value: scale.needsImprovementUpTo });

  return (
    <svg className={styles.axis} width="100%" height={AXIS_HEIGHT} aria-hidden="true" focusable="false">
      <line className={styles.tick} x1={percent(goodAt)} x2={percent(goodAt)} y1="0" y2={GOOD_TICK.lineEnd} />
      <TickLabel at={goodAt} baseline={GOOD_TICK.labelBaseline}>{`Good ≤ ${good}`}</TickLabel>
      <line className={styles.tick} x1={percent(poorAt)} x2={percent(poorAt)} y1="0" y2={POOR_TICK.lineEnd} />
      <TickLabel at={poorAt} baseline={POOR_TICK.labelBaseline}>{`Poor > ${poor}`}</TickLabel>
    </svg>
  );
};

/** What a screen reader hears instead of the drawing: the two values on the metric's scale. */
const describeBars = ({ metric, baseline, current }: VitalsEvidence, scale: Scale): string => {
  const value = (p75: number): string => formatMetricValue({ name: metric, value: p75 });
  return (
    `Baseline ${value(baseline.p75)} and current ${value(current.p75)} on the ${metric} scale: ` +
    `good up to ${value(scale.goodUpTo)}, poor above ${value(scale.needsImprovementUpTo)}.`
  );
};

export const VitalsComparison = ({ evidence }: VitalsComparisonProps): ReactElement => {
  const { metric, baseline, current, relativeIncrease } = evidence;
  const scale = scaleFor(evidence);

  return (
    <div className={styles.comparison}>
      <dl className={styles.figures}>
        <Figure label="Baseline" metric={metric} window={baseline} />
        <div className={styles.delta}>
          <dt className={styles.deltaLabel}>Change in p75</dt>
          <dd className={styles.deltaBody}>
            <svg
              className={styles.arrow}
              width="24"
              height="16"
              viewBox="0 0 24 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M2 8h19M15 2.5 21 8l-6 5.5" />
            </svg>
            <span className={styles.deltaChip} data-tone={changeTone(relativeIncrease) ?? "none"}>
              {formatRelativeIncrease(relativeIncrease)}
            </span>
          </dd>
        </div>
        <Figure label="Current" metric={metric} window={current} />
      </dl>

      <div className={styles.bars} role="img" aria-label={describeBars(evidence, scale)}>
        <span className={styles.barLabel}>Baseline</span>
        <Bar rating={baseline.rating} value={baseline.p75} scale={scale} />
        <span className={styles.barLabel}>Current</span>
        <Bar rating={current.rating} value={current.p75} scale={scale} />
        <span />
        <Axis metric={metric} scale={scale} />
      </div>
    </div>
  );
};
