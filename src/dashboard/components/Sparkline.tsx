// A metric's recent shape as a bare line, drawn beside its headline number.
// No axes and no labels on purpose: the card carries the value, the sparkline
// only says whether it has been rising, flat, or spiky. Shares the chart's
// scale maths so the two never disagree about the same points. It stretches
// to its box (the stroke stays one width through non-scaling-stroke), so one
// drawing fits every card width.
import type { ReactElement } from "react";
import { buildLinePath, scaleLinear, summarizeSeries, type ChartPoint } from "../chartScale";
import styles from "./Sparkline.module.css";

export interface SparklineProps {
  points: readonly ChartPoint[];
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 120;
const DEFAULT_HEIGHT = 32;
const PADDING = 3;
/** One point has no shape to show; two is the minimum for a line. */
const MIN_POINTS = 2;

export const Sparkline = ({ points, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT }: SparklineProps): ReactElement | null => {
  if (points.length < MIN_POINTS) {
    return null;
  }
  const ordered = [...points].sort((a, b) => a.t - b.t);
  const summary = summarizeSeries(ordered);
  const x = scaleLinear({ domain: [summary.first.t, summary.last.t], range: [PADDING, width - PADDING] });
  const y = scaleLinear({ domain: [summary.min, summary.max], range: [height - PADDING, PADDING] });
  const linePath = buildLinePath({ points: ordered, x, y });
  // The line closed down to the bottom edge, for the soft fill under it.
  const areaPath = `${linePath} L${x(summary.last.t).toFixed(1)},${height} L${x(summary.first.t).toFixed(1)},${height} Z`;
  // The end marker is a zero-length stroke with round caps, not a <circle>: the
  // drawing is stretched to the card (preserveAspectRatio="none"), which would
  // pull a circle's geometry into an ellipse, while a non-scaling stroke is
  // measured on screen and so stays round. The ring underneath is the same dot, wider.
  const endX = x(summary.last.t).toFixed(1);
  const endY = y(summary.last.value).toFixed(1);
  const endMarkerPath = `M${endX},${endY} L${endX},${endY}`;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={styles.sparkline}
    >
      <path d={areaPath} className={styles.area} />
      <path d={linePath} className={styles.line} vectorEffect="non-scaling-stroke" />
      <path d={endMarkerPath} className={styles.endRing} vectorEffect="non-scaling-stroke" />
      <path d={endMarkerPath} className={styles.end} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};
