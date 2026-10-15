// IncidentsTable with one row per shape that matters (a vitals regression
// still open, an approved health check, a resolved regression, and a path long
// enough to truncate), plus the empty state the overview shows most days.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { IncidentsTable, type IncidentRowData } from "./IncidentsTable";

const LONG_PATH =
  "/blog/2026/how-we-cut-largest-contentful-paint-in-half-without-touching-the-cdn-or-rewriting-the-marketing-site";

const INCIDENTS: IncidentRowData[] = [
  {
    id: "inc_01",
    source: "web-vitals",
    subject: "/pricing",
    metric: "LCP",
    status: "open",
    detectedAt: "2026-10-07T21:14:00.000Z",
    title: "LCP on /pricing",
    headline: "p75 2.6 s to 6.5 s (+150%), 31 and 29 samples",
  },
  {
    id: "inc_02",
    source: "health-check",
    subject: "api-health",
    metric: null,
    status: "approved",
    detectedAt: "2026-10-07T18:02:00.000Z",
    title: "API health",
    headline: "Failing for 2 observations (was OK): HTTP 503 from /healthz",
  },
  {
    id: "inc_03",
    source: "web-vitals",
    subject: LONG_PATH,
    metric: "CLS",
    status: "awaiting-human",
    detectedAt: "2026-10-06T09:40:00.000Z",
    title: `CLS on ${LONG_PATH}`,
    headline: "p75 0.08 to 0.31 (+288%), 44 and 52 samples",
  },
  {
    id: "inc_04",
    source: "web-vitals",
    subject: "/docs",
    metric: "INP",
    status: "resolved",
    detectedAt: "2026-10-01T07:12:00.000Z",
    title: "INP on /docs",
    headline: "p75 180 ms to 540 ms (+200%), 120 and 96 samples",
  },
];

const meta = {
  title: "Dashboard/IncidentsTable",
  component: IncidentsTable,
} satisfies Meta<typeof IncidentsTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Mixed: Story = {
  args: { incidents: INCIDENTS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstLink = canvas.getByRole("link", { name: "LCP on /pricing" });
    await expect(firstLink).toHaveAttribute("href", "/incidents/inc_01");
    await expect(canvas.getByText("Awaiting review")).toBeVisible();
    await expect(canvas.getByText("Resolved")).toBeVisible();
  },
};

export const Empty: Story = {
  args: { incidents: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No incidents\./)).toBeVisible();
    await expect(canvas.queryByRole("link")).toBeNull();
  },
};
