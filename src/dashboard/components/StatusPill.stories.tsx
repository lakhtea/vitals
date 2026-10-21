// StatusPill in every tone at both sizes: the neutral pill, the three rating
// colours, and the headline size with its dot.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusPill } from "./StatusPill";

const meta = {
  title: "Dashboard/StatusPill",
  component: StatusPill,
} satisfies Meta<typeof StatusPill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Neutral: Story = {
  args: { tone: null, children: "Dismissed" },
};

export const Good: Story = {
  args: { tone: "good", children: "Resolved" },
};

export const NeedsImprovement: Story = {
  args: { tone: "needs-improvement", children: "Fix proposed" },
};

export const Poor: Story = {
  args: { tone: "poor", children: "Awaiting review" },
};

export const Headline: Story = {
  args: { tone: "poor", size: "lg", children: "Awaiting review" },
};
