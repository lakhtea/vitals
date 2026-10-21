// The breadcrumb as the incident page and the page detail render it.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { BackToOverview } from "./BackToOverview";

const meta = {
  title: "Dashboard/BackToOverview",
  component: BackToOverview,
} satisfies Meta<typeof BackToOverview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Back to the overview" })).toHaveAttribute("href", "/");
  },
};
