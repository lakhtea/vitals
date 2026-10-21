// EmptyState with each of its icons: the "nothing here yet" moments the
// overview, the page detail, and the not-found pages can be in, and the form
// with a heading and a way forward.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "Dashboard/EmptyState",
  component: EmptyState,
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoSites: Story = {
  args: { icon: "sites", title: "No sites yet", children: "Run npm run db:seed for synthetic demo data." },
};

export const NoChecks: Story = {
  args: { icon: "checks", title: "No health checks reported yet", children: "Applications push them to POST /api/checks." },
};

export const NoSessions: Story = {
  args: {
    icon: "sessions",
    title: "No sessions recorded yet",
    children: "Wire the browser library and this fills in.",
  },
};

export const WithAction: Story = {
  args: {
    icon: "page",
    title: "No traffic matches these filters",
    titleLevel: "h2",
    children: "The path may still have traffic outside this view.",
    action: { href: "/sites/demo/pages/pricing?range=all", label: "Show all time" },
  },
};

export const NotFound: Story = {
  args: {
    icon: "search",
    title: "No such site",
    titleLevel: "h1",
    children: "Nothing is recorded under this site id.",
    action: { href: "/", label: "Go to the overview" },
  },
};
