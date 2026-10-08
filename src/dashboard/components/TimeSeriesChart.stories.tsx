// TimeSeriesChart across the shapes real data takes: a week of LCP crossing
// the thresholds, a CLS series that is flat except for one spike, a dense
// intraday series (no markers, time-of-day axis), and no data at all.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TimeSeriesChart, type ChartPoint } from "./TimeSeriesChart";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const WEEK_START = Date.UTC(2026, 9, 1);

const series = ({ values, start, stepMs }: { values: number[]; start: number; stepMs: number }): ChartPoint[] =>
  values.map((value, index) => ({ t: start + index * stepMs, value }));

const LCP_WEEK = series({
  values: [2180, 2340, 2610, 2470, 3120, 2890, 2710, 2650, 2420, 2260, 4380, 3310, 2790, 2580],
  start: WEEK_START,
  stepMs: MS_PER_DAY / 2,
});

const CLS_SPIKE = series({
  values: [0.01, 0.02, 0.01, 0.02, 0.03, 0.01, 0.42, 0.05, 0.02, 0.01, 0.02, 0.01, 0.01, 0.02],
  start: WEEK_START,
  stepMs: MS_PER_DAY / 2,
});

// 96 quarter-hour buckets of INP: a slow wave with a lunchtime bump.
const INP_DAY = series({
  values: Array.from({ length: 96 }, (_, index) => {
    const hourOfDay = index / 4;
    const wave = 170 + 40 * Math.sin((hourOfDay / 24) * Math.PI * 2);
    const bump = hourOfDay > 12 && hourOfDay < 14 ? 120 : 0;
    return Math.round(wave + bump);
  }),
  start: Date.UTC(2026, 9, 7),
  stepMs: MS_PER_HOUR / 4,
});

const meta = {
  title: "Dashboard/TimeSeriesChart",
  component: TimeSeriesChart,
} satisfies Meta<typeof TimeSeriesChart>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LcpWeek: Story = {
  args: { name: "LCP", points: LCP_WEEK },
};

export const ClsSpike: Story = {
  args: { name: "CLS", points: CLS_SPIKE },
};

export const InpIntraday: Story = {
  args: { name: "INP", points: INP_DAY },
};

export const Empty: Story = {
  args: { name: "LCP", points: [] },
};
