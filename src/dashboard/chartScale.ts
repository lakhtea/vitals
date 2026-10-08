// The arithmetic behind the time-series chart: mapping data to pixels, picking
// round axis ticks, and summarising a series. Pure functions, so the SVG
// component stays a plain description of what to draw.
export interface ChartPoint {
  /** Epoch milliseconds. */
  t: number;
  value: number;
}

export type Scale = (value: number) => number;

export const scaleLinear = ({
  domain,
  range,
}: {
  domain: readonly [number, number];
  range: readonly [number, number];
}): Scale => {
  const [domainStart, domainEnd] = domain;
  const [rangeStart, rangeEnd] = range;
  const domainSpan = domainEnd - domainStart;
  if (domainSpan === 0) {
    return () => (rangeStart + rangeEnd) / 2;
  }
  return (value) => rangeStart + ((value - domainStart) / domainSpan) * (rangeEnd - rangeStart);
};

const PATH_DECIMALS = 1;

export const buildLinePath = ({
  points,
  x,
  y,
}: {
  points: readonly ChartPoint[];
  x: Scale;
  y: Scale;
}): string =>
  points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${x(point.t).toFixed(PATH_DECIMALS)},${y(point.value).toFixed(PATH_DECIMALS)}`;
    })
    .join(" ");

const NICE_MULTIPLIERS = [1, 2, 2.5, 5, 10] as const;
const ROUNDING_PRECISION = 12;

/** The smallest "round" step (1, 2, 2.5, 5 times a power of ten) at or above roughStep. */
export const niceStep = (roughStep: number): number => {
  if (roughStep <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const multiplier = NICE_MULTIPLIERS.find((candidate) => candidate * magnitude >= roughStep) ?? 10;
  return multiplier * magnitude;
};

/** `count` evenly spaced round ticks starting at zero; the last one is at or above `max`. */
export const buildTicks = ({ max, count }: { max: number; count: number }): number[] => {
  const intervals = Math.max(count - 1, 1);
  const step = niceStep(max / intervals);
  return Array.from({ length: count }, (_, index) => Number((index * step).toPrecision(ROUNDING_PRECISION)));
};

export interface SeriesSummary {
  min: number;
  max: number;
  first: ChartPoint;
  last: ChartPoint;
}

/** Points must be non-empty and sorted by time. */
export const summarizeSeries = (points: readonly ChartPoint[]): SeriesSummary => {
  const [first] = points;
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error("summarizeSeries needs at least one point");
  }
  const values = points.map((point) => point.value);
  return { min: Math.min(...values), max: Math.max(...values), first, last };
};
