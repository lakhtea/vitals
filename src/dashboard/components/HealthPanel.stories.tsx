// HealthPanel with every status on show (passed out of order to prove the
// worst-first sort), an all-green site, and the empty state it shows until the
// first application pushes a check.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { HealthPanel, type HealthCheckData } from "./HealthPanel";

const OBSERVED_AT = "2026-10-07T21:14:00.000Z";

const MIXED: HealthCheckData[] = [
  {
    checkId: "database",
    name: "Database",
    status: "ok",
    value: 412,
    unit: "ms",
    observedAt: OBSERVED_AT,
    detail: null,
  },
  {
    checkId: "api-health",
    name: "API health",
    status: "failing",
    value: 503,
    unit: null,
    observedAt: "2026-10-07T21:13:30.000Z",
    detail: "HTTP 503 from /healthz",
  },
  {
    checkId: "cache-hit-rate",
    name: "Cache hit rate",
    status: "ok",
    value: 98.4,
    unit: "%",
    observedAt: OBSERVED_AT,
    detail: null,
  },
  {
    checkId: "queue-depth",
    name: "Queue depth",
    status: "degraded",
    value: 1240,
    unit: "jobs",
    observedAt: "2026-10-07T21:12:00.000Z",
    detail: "Above the 1,000-job warning line for 6 minutes",
  },
];

const ALL_OK: HealthCheckData[] = MIXED.map((check) => ({ ...check, status: "ok", detail: null }));

const meta = {
  title: "Dashboard/HealthPanel",
  component: HealthPanel,
} satisfies Meta<typeof HealthPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Mixed: Story = {
  args: { checks: MIXED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [first, second] = canvas.getAllByRole("listitem");
    await expect(within(first).getByRole("heading", { name: "API health" })).toBeVisible();
    await expect(within(first).getByText("Failing")).toBeVisible();
    await expect(within(second).getByText("Degraded")).toBeVisible();
    await expect(canvas.getByText("412 ms")).toBeVisible();
    await expect(canvas.getByText("HTTP 503 from /healthz")).toBeVisible();
  },
};

export const AllOk: Story = {
  args: { checks: ALL_OK },
};

export const Empty: Story = {
  args: { checks: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No health checks reported yet/)).toBeVisible();
    await expect(canvas.queryByRole("list")).toBeNull();
  },
};
