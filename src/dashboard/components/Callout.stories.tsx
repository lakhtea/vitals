// The two callouts the decision card shows: the gate waiting on a person, and
// the revision that was approved. The words are the ones the page uses, so
// the stories double as a check that the tone never replaces them.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { Callout } from "./Callout";

const meta = {
  title: "Dashboard/Callout",
  component: Callout,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Callout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AwaitingReview: Story = {
  args: {
    tone: "waiting",
    children:
      "The agents have finished their steps and stopped here. Nothing leaves the repository until you approve.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Nothing leaves the repository until you approve/)).toBeVisible();
  },
};

export const ApprovedRevision: Story = {
  args: {
    tone: "approved",
    children: "Approved revision 2. That exact revision is what will become the pull request.",
  },
};
