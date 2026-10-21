// One metric over time as inline SVG, with the web.dev rating bands drawn
// behind the line so "is this good?" is answered by position, not by reading
// the axis. Drawn twice, at a wide and a narrow viewBox, and CSS shows one:
// an SVG scales its text with its width, so a single 960-wide drawing would be
// unreadable on a phone and a resize observer would move the page after the
// first paint. A visually hidden table carries the same points for non-visual readers.
import { useId, type ReactElement } from "react";
import { formatMetricValue, metricLabel } from "@/vitals/format";
import { METRIC_THRESHOLDS, type MetricName } from "@/vitals/metrics";
import {
  buildFittedTicks,
  buildLinePath,
  scaleLinear,
  summarizeSeries,
  type ChartPoint,
  type Scale,
  type SeriesSummary,
} from "../chartScale";
import { formatDateTime, formatDay } from "../dates";
import styles from "./TimeSeriesChart.module.css";

export type { ChartPoint } from "../chartScale";

export interface TimeSeriesChartProps {
  name: MetricName;
  points: ChartPoint[];
  /** The wide drawing's size in viewBox units; the narrow one is fixed. */
  width?: number;
  height?: number;
}

interface ChartSize {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  /** How many dates label the x axis, first and last included. */
  dateLabels: number;
}

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 260;
const WIDE_MARGIN = { top: 12, right: 16, bottom: 28, left: 56 } as const;
/** Drawn at roughly 1:1 on a 390 px phone, so its 11 px labels stay 11 px. */
const NARROW_SIZE: ChartSize = {
  width: 360,
  height: 220,
  margin: { top: 12, right: 12, bottom: 26, left: 48 },
  dateLabels: 3,
};
const WIDE_DATE_LABELS = 5;
/** Four ticks read cleanly; up to six are allowed when they fit the data's top more tightly. */
const MIN_TICK_COUNT = 4;
const MAX_TICK_COUNT = 6;
const TICK_LABEL_GAP = 8;
const MARKER_RADIUS = 3;
/** The invisible circle that catches the pointer for a marker's tooltip. */
const MARKER_HIT_RADIUS = 10;
/** Past this many points the markers would overlap, so only the line is drawn. */
const MAX_MARKER_POINTS = 40;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Under this span the axis needs the hour too, or several labels read as the same day. */
const DAY_LABELS_FROM_MS = 3 * MS_PER_DAY;

/**
 * `count` evenly spaced timestamps from the first point to the last, which
 * the x axis labels. A series of one bucket (a site in its first hours, or a
 * narrow filter) has no span to space them over, so it gets one label at
 * the point rather than `count` copies of the same date on top of each other.
 */
const buildDateLabels = ({ summary, count }: { summary: SeriesSummary; count: number }): number[] => {
  const span = summary.last.t - summary.first.t;
  if (span === 0) {
    return [summary.first.t];
  }
  return Array.from({ length: count }, (_, index) => summary.first.t + (index / (count - 1)) * span);
};

const EmptyChart = (): ReactElement => (
  <div className={styles.empty}>
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

interface DrawingProps {
  name: MetricName;
  ordered: ChartPoint[];
  summary: SeriesSummary;
  size: ChartSize;
  /** The <title> and <desc> ids, unique per drawing. */
  titleId: string;
  descId: string;
  title: string;
  description: string;
  className: string;
}

const Drawing = ({ name, ordered, summary, size, titleId, descId, title, description, className }: DrawingProps): ReactElement => {
  const { width, height, margin } = size;
  const [, needsImprovementUpTo] = METRIC_THRESHOLDS[name];
  const ticks = buildFittedTicks({
    max: Math.max(summary.max, needsImprovementUpTo),
    minCount: MIN_TICK_COUNT,
    maxCount: MAX_TICK_COUNT,
  });
  const yTop = ticks[ticks.length - 1] ?? needsImprovementUpTo;

  const plot = { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom };
  const x = scaleLinear({ domain: [summary.first.t, summary.last.t], range: [plot.left, plot.right] });
  const y = scaleLinear({ domain: [0, yTop], range: [plot.bottom, plot.top] });

  const format = (value: number): string => formatMetricValue({ name, value });
  // The baseline is just "0": a unit on it would read as a measurement.
  const formatTick = (tick: number): string => (tick === 0 ? "0" : format(tick));
  const needsHourLabels = summary.last.t - summary.first.t < DAY_LABELS_FROM_MS;
  const formatAxisDate = needsHourLabels ? formatDateTime : formatDay;
  const dateLabels = buildDateLabels({ summary, count: size.dateLabels });
  const anchorFor = (index: number): "start" | "middle" | "end" => {
    if (dateLabels.length === 1) {
      return "middle";
    }
    if (index === 0) {
      return "start";
    }
    return index === dateLabels.length - 1 ? "end" : "middle";
  };

  return (
    <svg
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
    >
      <title id={titleId}>{title}</title>
      <desc id={descId}>{description}</desc>
      <RatingBands name={name} y={y} yTop={yTop} left={plot.left} right={plot.right} />
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} className={styles.grid} />
          <text x={plot.left - TICK_LABEL_GAP} y={y(tick)} textAnchor="end" dominantBaseline="middle" className={styles.tickLabel}>
            {formatTick(tick)}
          </text>
        </g>
      ))}
      <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} className={styles.axis} />
      {dateLabels.map((t, index) => (
        <text key={index} x={x(t)} y={height - TICK_LABEL_GAP} textAnchor={anchorFor(index)} className={styles.tickLabel}>
          {formatAxisDate(t)}
        </text>
      ))}
      <path d={buildLinePath({ points: ordered, x, y })} className={styles.line} />
      {ordered.length <= MAX_MARKER_POINTS &&
        ordered.map((point) => (
          <g key={point.t} className={styles.markerGroup}>
            <title>{`${formatDateTime(point.t)}: ${format(point.value)}`}</title>
            <circle cx={x(point.t)} cy={y(point.value)} r={MARKER_HIT_RADIUS} className={styles.hitArea} />
            <circle cx={x(point.t)} cy={y(point.value)} r={MARKER_RADIUS} className={styles.marker} />
          </g>
        ))}
    </svg>
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
    return <EmptyChart />;
  }

  const ordered = [...points].sort((a, b) => a.t - b.t);
  const summary = summarizeSeries(ordered);
  const format = (value: number): string => formatMetricValue({ name, value });
  const title = `${metricLabel(name)} over time`;
  const description =
    `${ordered.length} points from ${formatDateTime(summary.first.t)} to ${formatDateTime(summary.last.t)}. ` +
    `Lowest ${format(summary.min)}, highest ${format(summary.max)}, latest ${format(summary.last.value)}.`;
  const drawing = { name, ordered, summary, title, description };

  return (
    <div className={styles.chart}>
      <Drawing
        {...drawing}
        size={{ width, height, margin: WIDE_MARGIN, dateLabels: WIDE_DATE_LABELS }}
        titleId={`${id}-wide-title`}
        descId={`${id}-wide-desc`}
        className={styles.wide}
      />
      <Drawing
        {...drawing}
        size={NARROW_SIZE}
        titleId={`${id}-narrow-title`}
        descId={`${id}-narrow-desc`}
        className={styles.narrow}
      />

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
