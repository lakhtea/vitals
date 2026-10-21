// The page detail's no-data state in both forms: a filter that narrows the
// traffic to nothing (offers all time), and nothing ever recorded for the path
// (points back to the overview).
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageDetailEmptyState } from "./PageDetailEmptyState";

const meta = {
  title: "Dashboard/PageDetailEmptyState",
  component: PageDetailEmptyState,
} satisfies Meta<typeof PageDetailEmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoMatchForFilters: Story = {
  args: {
    siteId: "demo",
    path: "/pricing",
    filters: { range: "24h", deviceClass: "TABLET", connectionType: "SLOW_2G" },
  },
};

export const NeverRecorded: Story = {
  args: {
    siteId: "demo",
    path: "/pricng",
    filters: { range: "all", deviceClass: null, connectionType: null },
  },
};
