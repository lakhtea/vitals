// MetricTrend with a week of all five series (the tab switch is the
// interaction test), opened on a metric other than the default, with the
// chosen metric's series empty, and with no series at all.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { METRIC_NAMES, type MetricName } from "@/vitals/metrics";
import type { MetricSeriesData } from "../adapters";
import type { ChartPoint } from "../chartScale";
import { MetricTrend } from "./MetricTrend";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const WEEK_START = Date.UTC(2026, 9, 1);
const SAMPLES_PER_BUCKET = 40;

const series = (values: number[]): ChartPoint[] =>
  values.map((value, index) => ({ t: WEEK_START + index * SIX_HOURS_MS, value }));

const VALUES: Record<MetricName, number[]> = {
  LCP: [2180, 2340, 2610, 2470, 3120, 2890, 2710, 2650, 2420, 2260, 4380, 3310, 2790, 2580],
  CLS: [0.01, 0.02, 0.01, 0.02, 0.03, 0.01, 0.42, 0.05, 0.02, 0.01, 0.02, 0.01, 0.01, 0.02],
  INP: [180, 210, 260, 240, 320, 290, 310, 330, 300, 280, 340, 360, 310, 320],
  TTFB: [420, 460, 440, 480, 510, 470, 450, 430, 440, 460, 490, 520, 480, 466],
  FCP: [1480, 1520, 1610, 1570, 1720, 1690, 1640, 1600, 1550, 1500, 1900, 1750, 1620, 1600],
};

const WEEK: MetricSeriesData[] = METRIC_NAMES.map((name) => {
  const points = series(VALUES[name]);
  return { name, points, sampleCount: points.length * SAMPLES_PER_BUCKET };
});

const meta = {
  title: "Dashboard/MetricTrend",
  component: MetricTrend,
} satisfies Meta<typeof MetricTrend>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Week: Story = {
  args: { series: WEEK },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: "LCP" })).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByText(/^Largest Contentful Paint · p75/)).toBeVisible();

    await userEvent.click(canvas.getByRole("tab", { name: "CLS" }));
    await expect(canvas.getByRole("tab", { name: "CLS" })).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByText(/^Cumulative Layout Shift · p75/)).toBeVisible();
  },
};

export const OpenedOnInp: Story = {
  args: { series: WEEK, initialMetric: "INP" },
};

export const EmptySeries: Story = {
  args: { series: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No data for this range")).toBeVisible();
  },
};
