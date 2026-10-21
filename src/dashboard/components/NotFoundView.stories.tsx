// The not-found page both routes render: toolbar, breadcrumb, and the one
// empty-state shape with its h1 and a way back.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { NotFoundView } from "./NotFoundView";

const meta = {
  title: "Dashboard/NotFoundView",
  component: NotFoundView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NotFoundView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoSuchIncident: Story = {
  args: {
    title: "No such incident",
    children:
      "Nothing is recorded under this id. It may have been opened against another database, or the link is out of date.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1, name: "No such incident" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Go to the overview" })).toHaveAttribute("href", "/");
    await expect(canvas.getByRole("link", { name: "Vitals" })).toHaveAttribute("href", "/");
  },
};
