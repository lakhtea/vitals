// IncidentActions in the four states a reviewer meets: ready for a decision
// (with the interaction test that proves a typed note reaches onDecide), saving,
// after a failed save, and closed because the state machine allows no move.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { IncidentActions } from "./IncidentActions";

const meta = {
  title: "Dashboard/IncidentActions",
  component: IncidentActions,
  args: { onDecide: fn(), busy: false, error: null },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IncidentActions>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: { status: "open" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Note (optional)"), "  Planned maintenance window.  ");
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss" }));
    await expect(args.onDecide).toHaveBeenCalledWith("dismissed", "Planned maintenance window.");
  },
};

export const AwaitingReview: Story = {
  args: { status: "awaiting-human" },
};

export const Busy: Story = {
  args: { status: "open", busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Approve" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Dismiss" })).toBeDisabled();
    await expect(canvas.getByRole("status")).toHaveTextContent("Saving your decision");
  },
};

export const WithError: Story = {
  args: { status: "open", error: "Could not save the decision: the incident was changed by someone else. Reload and retry." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(/Could not save/);
    await expect(canvas.getByRole("button", { name: "Approve" })).toBeEnabled();
  },
};

export const Dismissed: Story = {
  args: { status: "dismissed" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("This incident is dismissed; no further decision is possible.")).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvas.queryByRole("textbox")).toBeNull();
  },
};
