// MetricCard in each rating with a sparkline of a week's buckets, with no
// data, with a series too short to draw, and with the one metric that is a
// unitless score rather than a duration.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ChartPoint } from "../chartScale";
import { MetricCard } from "./MetricCard";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const WEEK_START = Date.UTC(2026, 9, 1);

const series = (values: number[]): ChartPoint[] =>
  values.map((value, index) => ({ t: WEEK_START + index * SIX_HOURS_MS, value }));

const LCP_WEEK = series([2180, 2340, 2610, 2470, 3120, 2890, 2710, 2650, 2420, 2260, 4380, 3310, 2790, 2140]);
const INP_WEEK = series([180, 210, 260, 240, 320, 290, 310, 330, 300, 280, 340, 360, 310, 320]);
const LCP_REGRESSION = series([2600, 2700, 2500, 2800, 2900, 3100, 4800, 5200, 5600, 5300, 5480, 5400, 5600, 5480]);
const CLS_FLAT = series([0.05, 0.06, 0.05, 0.07, 0.06, 0.05, 0.08, 0.07, 0.06, 0.07, 0.06, 0.07, 0.07, 0.07]);

const meta = {
  title: "Dashboard/MetricCard",
  component: MetricCard,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 240 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MetricCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Good: Story = {
  args: { name: "LCP", p75: 2140, rating: "good", sampleCount: 1204, points: LCP_WEEK },
};

export const NeedsImprovement: Story = {
  args: { name: "INP", p75: 320, rating: "needs-improvement", sampleCount: 862, points: INP_WEEK },
};

export const Poor: Story = {
  args: { name: "LCP", p75: 5480, rating: "poor", sampleCount: 97, points: LCP_REGRESSION },
};

export const NoData: Story = {
  args: { name: "TTFB", p75: null, rating: null, sampleCount: 0, points: [] },
};

/** One bucket has no shape: the card keeps the sparkline's row so a row of cards stays level. */
export const SinglePoint: Story = {
  args: { name: "FCP", p75: 1620, rating: "good", sampleCount: 3, points: series([1620]) },
};

export const ClsValue: Story = {
  args: { name: "CLS", p75: 0.07, rating: "good", sampleCount: 1180, points: CLS_FLAT },
};
