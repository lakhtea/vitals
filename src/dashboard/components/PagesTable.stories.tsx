// PagesTable with realistic traffic (one very long path, one absurd LCP, one
// page with no INP), the empty state, an all-poor site, and the sorting
// interaction test.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { rateMetric, type MetricName } from "@/vitals/metrics";
import type { PageMetricSummary, PageRowData } from "../sortPages";
import { PagesTable } from "./PagesTable";

const metric = (name: MetricName, p75: number): PageMetricSummary => ({
  name,
  p75,
  p75Rating: rateMetric({ name, value: p75 }),
});

const LONG_PATH =
  "/blog/2026/how-we-cut-largest-contentful-paint-in-half-without-touching-the-cdn-or-rewriting-the-marketing-site";
const SLOWEST_LCP_PATH = LONG_PATH;
const FASTEST_LCP_PATH = "/status";

const PAGES: PageRowData[] = [
  { path: "/", pageviewCount: 12840, metrics: [metric("LCP", 2140), metric("CLS", 0.04), metric("INP", 160)] },
  { path: "/pricing", pageviewCount: 6420, metrics: [metric("LCP", 2860), metric("CLS", 0.12), metric("INP", 210)] },
  { path: "/docs", pageviewCount: 5310, metrics: [metric("LCP", 1980), metric("CLS", 0.02), metric("INP", 95)] },
  { path: "/blog", pageviewCount: 3980, metrics: [metric("LCP", 3420), metric("CLS", 0.08), metric("INP", 540)] },
  { path: LONG_PATH, pageviewCount: 2210, metrics: [metric("LCP", 48120), metric("CLS", 0.31), metric("INP", 380)] },
  { path: "/signup", pageviewCount: 1870, metrics: [metric("LCP", 2440), metric("CLS", 0.05), metric("INP", 190)] },
  { path: FASTEST_LCP_PATH, pageviewCount: 940, metrics: [metric("LCP", 1120), metric("CLS", 0)] },
  { path: "/changelog", pageviewCount: 610, metrics: [metric("LCP", 2710), metric("CLS", 0.09), metric("INP", 230)] },
];

const ALL_POOR: PageRowData[] = [
  { path: "/", pageviewCount: 3120, metrics: [metric("LCP", 6200), metric("CLS", 0.41), metric("INP", 820)] },
  { path: "/checkout", pageviewCount: 1480, metrics: [metric("LCP", 7900), metric("CLS", 0.28), metric("INP", 1240)] },
  { path: "/account", pageviewCount: 760, metrics: [metric("LCP", 5100), metric("CLS", 0.33), metric("INP", 610)] },
];

const meta = {
  title: "Dashboard/PagesTable",
  component: PagesTable,
} satisfies Meta<typeof PagesTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { pages: PAGES },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstBodyRowPath = (): string | null => {
      const [, firstBodyRow] = canvas.getAllByRole("row");
      return within(firstBodyRow).getByRole("rowheader").textContent;
    };

    await userEvent.click(canvas.getByRole("button", { name: "LCP" }));
    await expect(firstBodyRowPath()).toBe(SLOWEST_LCP_PATH);

    await userEvent.click(canvas.getByRole("button", { name: "LCP" }));
    await expect(firstBodyRowPath()).toBe(FASTEST_LCP_PATH);
  },
};

export const Empty: Story = {
  args: { pages: [] },
};

export const AllPoor: Story = {
  args: { pages: ALL_POOR },
};
