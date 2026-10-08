// One metric over time as inline SVG, with the web.dev rating bands drawn
// behind the line so "is this good?" is answered by position, not by reading
// the axis. A visually hidden table carries the same points for non-visual readers.
import { useId, type ReactElement } from "react";
import { formatMetricValue, metricLabel } from "@/vitals/format";
import { METRIC_THRESHOLDS, type MetricName } from "@/vitals/metrics";
import { buildLinePath, buildTicks, scaleLinear, summarizeSeries, type ChartPoint, type Scale } from "../chartScale";
import { formatDateTime, formatDay } from "../dates";
import styles from "./TimeSeriesChart.module.css";

export type { ChartPoint } from "../chartScale";

export interface TimeSeriesChartProps {
  name: MetricName;
  points: ChartPoint[];
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 200;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 56 } as const;
const TICK_COUNT = 4;
const TICK_LABEL_GAP = 8;
const MARKER_RADIUS = 3.5;
/** Past this many points the markers would overlap, so only the line is drawn. */
const MAX_MARKER_POINTS = 40;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const EmptyChart = ({ width, height }: { width: number; height: number }): ReactElement => (
  <div className={styles.empty} style={{ maxWidth: width, aspectRatio: `${width} / ${height}` }}>
    <p>No data for this range</p>
  </div>
);

const RatingBands = ({
  name,
  y,
  yTop,
  left,
  right,
}: {
  name: MetricName;
  y: Scale;
  yTop: number;
  left: number;
  right: number;
}): ReactElement => {
  const [goodUpTo, needsImprovementUpTo] = METRIC_THRESHOLDS[name];
  const clamp = (value: number): number => Math.min(value, yTop);
  const band = (from: number, to: number): { y: number; height: number } => ({
    y: y(clamp(to)),
    height: Math.max(y(from) - y(clamp(to)), 0),
  });
  const width = right - left;
  return (
    <g>
      <rect x={left} width={width} {...band(0, goodUpTo)} className={styles.band} data-rating="good" />
      <rect
        x={left}
        width={width}
        {...band(goodUpTo, needsImprovementUpTo)}
        className={styles.band}
        data-rating="needs-improvement"
      />
      <rect x={left} width={width} {...band(needsImprovementUpTo, yTop)} className={styles.band} data-rating="poor" />
      <line x1={left} x2={right} y1={y(goodUpTo)} y2={y(goodUpTo)} className={styles.threshold} data-rating="needs-improvement" />
      <line x1={left} x2={right} y1={y(clamp(needsImprovementUpTo))} y2={y(clamp(needsImprovementUpTo))} className={styles.threshold} data-rating="poor" />
    </g>
  );
};

export const TimeSeriesChart = ({
  name,
  points,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: TimeSeriesChartProps): ReactElement => {
  const id = useId();
  if (points.length === 0) {
    return <EmptyChart width={width} height={height} />;
  }

  const ordered = [...points].sort((a, b) => a.t - b.t);
  const summary = summarizeSeries(ordered);
  const [, needsImprovementUpTo] = METRIC_THRESHOLDS[name];
  const ticks = buildTicks({ max: Math.max(summary.max, needsImprovementUpTo), count: TICK_COUNT });
  const yTop = ticks[ticks.length - 1] ?? needsImprovementUpTo;

  const plot = { left: MARGIN.left, right: width - MARGIN.right, top: MARGIN.top, bottom: height - MARGIN.bottom };
  const x = scaleLinear({ domain: [summary.first.t, summary.last.t], range: [plot.left, plot.right] });
  const y = scaleLinear({ domain: [0, yTop], range: [plot.bottom, plot.top] });

  const format = (value: number): string => formatMetricValue({ name, value });
  const spansLessThanADay = summary.last.t - summary.first.t < MS_PER_DAY;
  const formatAxisDate = spansLessThanADay ? formatDateTime : formatDay;
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const title = `${metricLabel(name)} over time`;
  const description =
    `${ordered.length} points from ${formatDateTime(summary.first.t)} to ${formatDateTime(summary.last.t)}. ` +
    `Lowest ${format(summary.min)}, highest ${format(summary.max)}, latest ${format(summary.last.value)}.`;

  return (
    <div className={styles.chart} style={{ maxWidth: width }}>
      <svg
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={styles.svg}
      >
        <title id={titleId}>{title}</title>
        <desc id={descId}>{description}</desc>
        <RatingBands name={name} y={y} yTop={yTop} left={plot.left} right={plot.right} />
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} className={styles.grid} />
            <text x={plot.left - TICK_LABEL_GAP} y={y(tick)} textAnchor="end" dominantBaseline="middle" className={styles.tickLabel}>
              {format(tick)}
            </text>
          </g>
        ))}
        <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} className={styles.axis} />
        <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} className={styles.axis} />
        <text x={plot.left} y={height - TICK_LABEL_GAP} textAnchor="start" className={styles.tickLabel}>
          {formatAxisDate(summary.first.t)}
        </text>
        <text x={plot.right} y={height - TICK_LABEL_GAP} textAnchor="end" className={styles.tickLabel}>
          {formatAxisDate(summary.last.t)}
        </text>
        <path d={buildLinePath({ points: ordered, x, y })} className={styles.line} />
        {ordered.length <= MAX_MARKER_POINTS &&
          ordered.map((point) => (
            <circle key={point.t} cx={x(point.t)} cy={y(point.value)} r={MARKER_RADIUS} className={styles.marker}>
              <title>{`${formatDateTime(point.t)}: ${format(point.value)}`}</title>
            </circle>
          ))}
      </svg>

      <table className={styles.visuallyHidden}>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((point) => (
            <tr key={point.t}>
              <td>{formatDateTime(point.t)}</td>
              <td>{format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
