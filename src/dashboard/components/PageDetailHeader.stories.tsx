// The page detail header with its facts, a path long enough to wrap, and the
// no-facts form the empty state uses.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageDetailHeader } from "./PageDetailHeader";

const meta = {
  title: "Dashboard/PageDetailHeader",
  component: PageDetailHeader,
} satisfies Meta<typeof PageDetailHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    path: "/pricing",
    siteName: "Demo site (synthetic traffic)",
    facts: { pageviewCount: 1204, sampleCount: 5612 },
  },
};

export const LongPath: Story = {
  args: {
    path: "/blog/2026/how-we-cut-largest-contentful-paint-in-half-without-touching-the-cdn-or-the-image-pipeline",
    siteName: "Demo site (synthetic traffic)",
    facts: { pageviewCount: 37, sampleCount: 161 },
  },
};

export const WithoutFacts: Story = {
  args: { path: "/pricing", siteName: "Demo site (synthetic traffic)", facts: null },
};
