// The brand both ways: the overview's h1 with its tagline, and the link home
// the other routes put in the same toolbar slot, at the same size.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { Brand, BrandLink } from "./Brand";

const meta = {
  title: "Dashboard/Brand",
  component: Brand,
} satisfies Meta<typeof Brand>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Heading: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1, name: "Vitals" })).toBeVisible();
  },
};

export const LinkHome: Story = {
  render: () => <BrandLink />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Vitals" })).toHaveAttribute("href", "/");
    await expect(canvas.queryByRole("heading")).toBeNull();
  },
};
