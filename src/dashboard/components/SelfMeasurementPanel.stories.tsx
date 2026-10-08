// SelfMeasurementPanel with a plausible set of self-reported sessions (all
// three ratings on show, fewer INP samples because INP needs an interaction)
// and the empty state it shows until the browser library (M3) reports in.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { rateMetric, type MetricName } from "@/vitals/metrics";
import { SelfMeasurementPanel, type SelfMeasuredMetric } from "./SelfMeasurementPanel";

const measured = ({
  name,
  p75,
  sampleCount,
}: {
  name: MetricName;
  p75: number;
  sampleCount: number;
}): SelfMeasuredMetric => ({ name, p75, rating: rateMetric({ name, value: p75 }), sampleCount });

const meta = {
  title: "Dashboard/SelfMeasurementPanel",
  component: SelfMeasurementPanel,
} satisfies Meta<typeof SelfMeasurementPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithData: Story = {
  args: {
    metrics: [
      measured({ name: "LCP", p75: 2860, sampleCount: 312 }),
      measured({ name: "CLS", p75: 0.02, sampleCount: 298 }),
      measured({ name: "INP", p75: 540, sampleCount: 187 }),
      measured({ name: "TTFB", p75: 180, sampleCount: 312 }),
      measured({ name: "FCP", p75: 1240, sampleCount: 305 }),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("term")).toHaveLength(5);
    await expect(canvas.getByText("2.9 s")).toBeVisible();
    await expect(canvas.getByText("Needs improvement")).toBeVisible();
    await expect(canvas.getByText("187 samples")).toBeVisible();
  },
};

export const Empty: Story = {
  args: { metrics: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No sessions recorded yet/)).toBeVisible();
    await expect(canvas.queryByRole("term")).toBeNull();
  },
};
