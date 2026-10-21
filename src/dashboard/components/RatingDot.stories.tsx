// The rating dot in its three colours and neutral, each beside its word, and
// once with the word hidden but spoken, as the tables use it beside a figure.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ratingLabel } from "@/vitals/format";
import { RatingDot } from "./RatingDot";

const meta = {
  title: "Dashboard/RatingDot",
  component: RatingDot,
} satisfies Meta<typeof RatingDot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EveryRating: Story = {
  args: { rating: "good" },
  render: () => (
    <ul style={{ display: "grid", gap: "0.5rem", listStyle: "none" }}>
      {(["good", "needs-improvement", "poor"] as const).map((rating) => (
        <li key={rating} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <RatingDot rating={rating} />
          {ratingLabel(rating)}
        </li>
      ))}
      <li style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <RatingDot rating={null} />
        No data
      </li>
    </ul>
  ),
};

export const SpokenLabel: Story = {
  args: { rating: "poor", label: "Poor" },
  render: (args) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <RatingDot {...args} />
      5.5 s
    </span>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // In the document for a screen reader, clipped to a pixel for everyone else.
    const label = canvas.getByText("Poor");
    await expect(label).toBeInTheDocument();
    await expect(getComputedStyle(label).clipPath).toBe("inset(50%)");
  },
};
