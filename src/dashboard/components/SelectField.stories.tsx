// SelectField as the toolbar uses it: the site picker with one long site
// name, and a time range picker with its four options. The border is the
// control's whole visible edge, so the a11y run checks it against the surface.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SelectField } from "./SelectField";

const meta = {
  title: "Dashboard/SelectField",
  component: SelectField,
  args: { onChange: () => undefined },
} satisfies Meta<typeof SelectField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Site: Story = {
  args: {
    id: "story-site",
    label: "Site",
    value: "demo",
    children: (
      <>
        <option value="demo">Demo site (synthetic traffic)</option>
        <option value="vitals-dashboard">Vitals dashboard (self-measured)</option>
      </>
    ),
  },
};

export const TimeRange: Story = {
  args: {
    id: "story-range",
    label: "Time range",
    value: "7d",
    children: (
      <>
        <option value="24h">Last 24 hours</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="all">All time</option>
      </>
    ),
  },
};
