// SectionHeader as the sections use it: a bare title, a title with its count,
// a title with a description, and a title with a pill beside it.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { SectionHeader } from "./SectionHeader";
import { StatusPill } from "./StatusPill";

const meta = {
  title: "Dashboard/SectionHeader",
  component: SectionHeader,
} satisfies Meta<typeof SectionHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Title: Story = {
  args: { title: "Evidence" },
};

export const WithCount: Story = {
  args: { title: "Incidents", count: 2 },
};

export const WithDescription: Story = {
  args: { title: "Recent sessions", description: "The last 50 sessions that match the filters." },
};

export const WithBadge: Story = {
  args: {
    title: "Proposed change",
    badge: <StatusPill tone="needs-improvement">Edited since last review</StatusPill>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The pill sits beside the heading, never inside its name.
    await expect(canvas.getByRole("heading", { level: 2, name: "Proposed change" })).toBeVisible();
    await expect(canvas.getByText("Edited since last review")).toBeVisible();
  },
};
