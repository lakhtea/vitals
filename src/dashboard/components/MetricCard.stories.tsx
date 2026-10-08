// MetricCard in each rating, with no data, and with the one metric that is a
// unitless score rather than a duration.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MetricCard } from "./MetricCard";

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
  args: { name: "LCP", p75: 2140, rating: "good", sampleCount: 1204 },
};

export const NeedsImprovement: Story = {
  args: { name: "INP", p75: 320, rating: "needs-improvement", sampleCount: 862 },
};

export const Poor: Story = {
  args: { name: "LCP", p75: 5480, rating: "poor", sampleCount: 97 },
};

export const NoData: Story = {
  args: { name: "TTFB", p75: null, rating: null, sampleCount: 0 },
};

export const ClsValue: Story = {
  args: { name: "CLS", p75: 0.07, rating: "good", sampleCount: 1180 },
};
