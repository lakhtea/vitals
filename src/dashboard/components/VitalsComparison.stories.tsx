// VitalsComparison across the scales it has to fit: a regression that crosses
// into poor (the scale ends at the current value), one that stays inside the
// needs-improvement band (the scale ends past the poor threshold so the band
// is still drawn), CLS with its decimal thresholds, and a recovery that reads
// as a drop.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import type { VitalsEvidence, WindowSummary } from "@/incidents/evidence";
import { rateMetric, type MetricName } from "@/vitals/metrics";
import { VitalsComparison } from "./VitalsComparison";

const at = (iso: string): number => Date.parse(iso);

const window = ({ metric, p75, sampleCount }: { metric: MetricName; p75: number; sampleCount: number }): WindowSummary => ({
  from: at("2026-09-30T00:00:00.000Z"),
  to: at("2026-10-07T00:00:00.000Z"),
  p75,
  sampleCount,
  rating: rateMetric({ name: metric, value: p75 }),
});

const evidence = ({
  metric,
  baseline,
  current,
}: {
  metric: MetricName;
  baseline: number;
  current: number;
}): VitalsEvidence => {
  const before = window({ metric, p75: baseline, sampleCount: 31 });
  const after = { ...window({ metric, p75: current, sampleCount: 29 }), from: at("2026-10-07T00:00:00.000Z"), to: at("2026-10-08T00:00:00.000Z") };
  return {
    kind: "web-vitals",
    path: "/pricing",
    metric,
    baseline: before,
    current: after,
    relativeIncrease: (current - baseline) / baseline,
  };
};

const meta = {
  title: "Dashboard/VitalsComparison",
  component: VitalsComparison,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VitalsComparison>;

export default meta;

type Story = StoryObj<typeof meta>;

export const IntoPoor: Story = {
  args: { evidence: evidence({ metric: "LCP", baseline: 2600, current: 6500 }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("2.6 s")).toBeVisible();
    await expect(canvas.getByText("6.5 s")).toBeVisible();
    await expect(canvas.getByText("+150%")).toBeVisible();
    await expect(canvas.getByText("Poor")).toBeVisible();
    await expect(canvas.getByRole("img", { name: /Baseline 2.6 s and current 6.5 s on the LCP scale/ })).toBeVisible();
  },
};

export const WithinNeedsImprovement: Story = {
  args: { evidence: evidence({ metric: "INP", baseline: 220, current: 410 }) },
};

export const LayoutShift: Story = {
  args: { evidence: evidence({ metric: "CLS", baseline: 0.08, current: 0.32 }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("0.32")).toBeVisible();
    await expect(canvas.getByText("+300%")).toBeVisible();
  },
};

export const Recovered: Story = {
  args: { evidence: evidence({ metric: "TTFB", baseline: 1900, current: 600 }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("-68%")).toBeVisible();
  },
};
