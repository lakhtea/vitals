// Sparkline in the shapes a card meets: a rising week, a flat one, the
// two-point minimum, and a single bucket, which draws nothing. The box is
// wide and short on purpose: the drawing stretches to it, and the end marker
// must stay a round dot however far it is stretched.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ChartPoint } from "../chartScale";
import { Sparkline } from "./Sparkline";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const WEEK_START = Date.UTC(2026, 9, 1);

const series = (values: number[]): ChartPoint[] =>
  values.map((value, index) => ({ t: WEEK_START + index * SIX_HOURS_MS, value }));

const meta = {
  title: "Dashboard/Sparkline",
  component: Sparkline,
  args: { width: 160, height: 36 },
  decorators: [
    (Story) => (
      <div style={{ width: 320, height: 36, color: "var(--rating-good)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sparkline>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rising: Story = {
  args: { points: series([2180, 2340, 2610, 2470, 3120, 2890, 2710, 2650, 2420, 2260, 4380, 3310, 2790, 3140]) },
};

export const Flat: Story = {
  args: { points: series([0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07]) },
};

export const TwoPoints: Story = {
  args: { points: series([1800, 2400]) },
};

/** One bucket has no shape; the component renders nothing and the card keeps the row. */
export const OnePoint: Story = {
  args: { points: series([1620]) },
};
