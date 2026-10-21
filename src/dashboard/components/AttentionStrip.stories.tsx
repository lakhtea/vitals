// AttentionStrip with problems to point at (each item a link to its section),
// with a single problem (singular wording), and all clear.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { AttentionStrip } from "./AttentionStrip";

const meta = {
  title: "Dashboard/AttentionStrip",
  component: AttentionStrip,
} satisfies Meta<typeof AttentionStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Problems: Story = {
  args: { summary: { openIncidents: 2, failingChecks: 1, degradedChecks: 1 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "2 open incidents" })).toHaveAttribute("href", "#incidents");
    await expect(canvas.getByRole("link", { name: "1 failing check" })).toHaveAttribute("href", "#health");
    await expect(canvas.getByRole("link", { name: "1 degraded check" })).toHaveAttribute("href", "#health");
  },
};

export const OneIncident: Story = {
  args: { summary: { openIncidents: 1, failingChecks: 0, degradedChecks: 0 } },
};

export const AllClear: Story = {
  args: { summary: { openIncidents: 0, failingChecks: 0, degradedChecks: 0 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("All clear: no open incidents, every check OK")).toBeVisible();
    await expect(canvas.queryByRole("link")).toBeNull();
  },
};
