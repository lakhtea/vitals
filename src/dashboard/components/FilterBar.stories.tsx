// FilterBar at its defaults and with every filter set, plus the interaction
// test that proves a select change reaches onChange. A stateful wrapper keeps
// the controlled selects responsive in the Storybook UI.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ReactElement } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { DEFAULT_FILTERS, FilterBar, type FilterBarProps } from "./FilterBar";

const StatefulFilterBar = ({ value, onChange }: FilterBarProps): ReactElement => {
  const [current, setCurrent] = useState(value);
  return (
    <FilterBar
      value={current}
      onChange={(next) => {
        setCurrent(next);
        onChange(next);
      }}
    />
  );
};

const meta = {
  title: "Dashboard/FilterBar",
  component: FilterBar,
  render: (args) => <StatefulFilterBar {...args} />,
  args: { onChange: fn() },
} satisfies Meta<typeof FilterBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: DEFAULT_FILTERS },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByLabelText("Device"), "MOBILE");
    await expect(args.onChange).toHaveBeenCalledWith(expect.objectContaining({ deviceClass: "MOBILE" }));
  },
};

export const Filtered: Story = {
  args: { value: { range: "24h", deviceClass: "MOBILE", connectionType: "FOUR_G" } },
};
