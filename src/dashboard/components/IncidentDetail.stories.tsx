// IncidentDetail in the states the plan names: a fresh vitals regression with
// an empty timeline, a dismissed health check with the human's note and step,
// a resolved regression with a long note and a full agent timeline, and a path
// long enough to test wrapping in the title and the evidence caption.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import type { CheckEvidence, VitalsEvidence, WindowSummary } from "@/incidents/evidence";
import { rateMetric, type MetricName } from "@/vitals/metrics";
import { IncidentDetail, type IncidentDetailData, type IncidentStepData } from "./IncidentDetail";

const at = (iso: string): number => Date.parse(iso);

const window = ({
  metric,
  from,
  to,
  p75,
  sampleCount,
}: {
  metric: MetricName;
  from: string;
  to: string;
  p75: number;
  sampleCount: number;
}): WindowSummary => ({
  from: at(from),
  to: at(to),
  p75,
  sampleCount,
  rating: rateMetric({ name: metric, value: p75 }),
});

const vitalsEvidence = ({
  path,
  metric,
  baseline,
  current,
}: {
  path: string;
  metric: MetricName;
  baseline: WindowSummary;
  current: WindowSummary;
}): VitalsEvidence => ({
  kind: "web-vitals",
  path,
  metric,
  baseline,
  current,
  relativeIncrease: (current.p75 - baseline.p75) / baseline.p75,
});

const LCP_PRICING = vitalsEvidence({
  path: "/pricing",
  metric: "LCP",
  baseline: window({
    metric: "LCP",
    from: "2026-09-30T00:00:00.000Z",
    to: "2026-10-07T00:00:00.000Z",
    p75: 2600,
    sampleCount: 31,
  }),
  current: window({
    metric: "LCP",
    from: "2026-10-07T00:00:00.000Z",
    to: "2026-10-08T00:00:00.000Z",
    p75: 6500,
    sampleCount: 29,
  }),
});

const API_HEALTH: CheckEvidence = {
  kind: "health-check",
  checkId: "api-health",
  name: "API health",
  status: "failing",
  previousStatus: "ok",
  consecutive: 2,
  value: 503,
  unit: null,
  observedAt: at("2026-10-07T18:02:00.000Z"),
  detail: "HTTP 503 from /healthz",
};

const step = (overrides: Partial<IncidentStepData> & Pick<IncidentStepData, "id" | "role">): IncidentStepData => ({
  status: "succeeded",
  startedAt: "2026-10-07T21:15:00.000Z",
  finishedAt: "2026-10-07T21:15:40.000Z",
  summary: "",
  detail: null,
  model: null,
  inputTokens: null,
  outputTokens: null,
  costUsd: null,
  link: null,
  ...overrides,
});

const VITALS_OPEN: IncidentDetailData = {
  id: "inc_01",
  source: "web-vitals",
  subject: "/pricing",
  metric: "LCP",
  status: "open",
  detectedAt: "2026-10-07T21:14:00.000Z",
  updatedAt: "2026-10-07T21:14:00.000Z",
  resolvedAt: null,
  note: null,
  evidence: LCP_PRICING,
  steps: [],
};

const CHECK_DISMISSED: IncidentDetailData = {
  id: "inc_02",
  source: "health-check",
  subject: "api-health",
  metric: null,
  status: "dismissed",
  detectedAt: "2026-10-07T18:02:00.000Z",
  updatedAt: "2026-10-07T18:20:00.000Z",
  resolvedAt: null,
  note: "Planned maintenance window; the API was down on purpose.",
  evidence: API_HEALTH,
  steps: [
    step({
      id: "step_01",
      role: "human",
      startedAt: "2026-10-07T18:20:00.000Z",
      finishedAt: "2026-10-07T18:20:00.000Z",
      summary: "Dismissed: planned maintenance window; the API was down on purpose.",
    }),
  ],
};

const LONG_NOTE =
  "Approved after checking the CDN logs: the hero image on /pricing lost its cache headers in the 2026-10-06 deploy, " +
  "so every visitor pulled the full 1.8 MB original from origin. The proposed fix restores the immutable cache policy " +
  "and adds a width hint so the browser can pick the 800 px rendition on mobile. Re-check the p75 over the next full " +
  "window before closing; the band should return to needs-improvement, and the follow-up to move it to good is tracked " +
  "separately so this incident stays about the regression and not the backlog.";

const RESOLVED_VITALS: IncidentDetailData = {
  ...VITALS_OPEN,
  id: "inc_03",
  status: "resolved",
  updatedAt: "2026-10-09T02:00:00.000Z",
  resolvedAt: "2026-10-09T02:00:00.000Z",
  note: LONG_NOTE,
  steps: [
    step({
      id: "step_11",
      role: "summarize",
      startedAt: "2026-10-07T21:15:00.000Z",
      finishedAt: "2026-10-07T21:15:42.000Z",
      summary: "LCP on /pricing worsened from 2.6 s to 6.5 s after the Oct 6 deploy; the hero image is the LCP element.",
      model: "claude-sonnet-4-5",
      inputTokens: 12400,
      outputTokens: 1830,
      costUsd: 0.0412,
    }),
    step({
      id: "step_12",
      role: "propose-fix",
      startedAt: "2026-10-07T21:16:00.000Z",
      finishedAt: "2026-10-07T21:19:10.000Z",
      summary: "Restore the immutable cache policy on /images/pricing-hero.* and add a width hint.",
      detail: "Two files changed: next.config.ts (headers) and app/pricing/page.tsx (the <Image> sizes attribute).",
      model: "claude-sonnet-4-5",
      inputTokens: 48200,
      outputTokens: 6100,
      costUsd: 0.236,
    }),
    step({
      id: "step_13",
      role: "review",
      startedAt: "2026-10-07T21:19:30.000Z",
      finishedAt: "2026-10-07T21:21:05.000Z",
      summary: "Tests pass; the change is scoped to caching and does not alter rendered markup.",
      model: "claude-sonnet-4-5",
      inputTokens: 30100,
      outputTokens: 2200,
      costUsd: 0.123,
    }),
    step({
      id: "step_14",
      role: "human",
      startedAt: "2026-10-08T08:02:00.000Z",
      finishedAt: "2026-10-08T08:02:00.000Z",
      summary: "Approved with a note.",
    }),
    step({
      id: "step_15",
      role: "open-pr",
      startedAt: "2026-10-08T08:02:30.000Z",
      finishedAt: "2026-10-08T08:03:15.000Z",
      summary: "Opened pull request #184 against lakhtea/marketing-site.",
      link: "https://github.com/lakhtea/marketing-site/pull/184",
      model: "claude-sonnet-4-5",
      inputTokens: 4100,
      outputTokens: 600,
      costUsd: 0.018,
    }),
  ],
};

const LONG_PATH =
  "/blog/2026/how-we-cut-largest-contentful-paint-in-half-without-touching-the-cdn-or-rewriting-the-marketing-site";

const LONG_PATH_INCIDENT: IncidentDetailData = {
  id: "inc_04",
  source: "web-vitals",
  subject: LONG_PATH,
  metric: "CLS",
  status: "triaged",
  detectedAt: "2026-10-06T09:40:00.000Z",
  updatedAt: "2026-10-06T09:41:00.000Z",
  resolvedAt: null,
  note: null,
  evidence: vitalsEvidence({
    path: LONG_PATH,
    metric: "CLS",
    baseline: window({
      metric: "CLS",
      from: "2026-09-29T00:00:00.000Z",
      to: "2026-10-06T00:00:00.000Z",
      p75: 0.08,
      sampleCount: 44,
    }),
    current: window({
      metric: "CLS",
      from: "2026-10-06T00:00:00.000Z",
      to: "2026-10-07T00:00:00.000Z",
      p75: 0.31,
      sampleCount: 52,
    }),
  }),
  steps: [
    step({
      id: "step_21",
      role: "summarize",
      status: "running",
      startedAt: "2026-10-06T09:41:00.000Z",
      finishedAt: null,
      summary: "Reading the two windows and the recent sessions on this path.",
      model: "claude-sonnet-4-5",
    }),
  ],
};

const meta = {
  title: "Dashboard/IncidentDetail",
  component: IncidentDetail,
} satisfies Meta<typeof IncidentDetail>;

export default meta;

type Story = StoryObj<typeof meta>;

export const VitalsOpen: Story = {
  args: { incident: VITALS_OPEN },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1, name: "LCP on /pricing" })).toBeVisible();
    await expect(canvas.getByText("Baseline", { selector: "dt" })).toBeVisible();
    await expect(canvas.getByText("6.5 s")).toBeVisible();
    await expect(canvas.getByText("+150%")).toBeVisible();
    // The bars are a drawing; what a screen reader gets is the two values on the metric's scale.
    await expect(canvas.getByRole("img", { name: /good up to 2.5 s, poor above 4.0 s/ })).toBeVisible();
    await expect(canvas.getByText(/No steps yet/)).toBeVisible();
  },
};

export const CheckWithHumanStep: Story = {
  args: { incident: CHECK_DISMISSED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Planned maintenance window/)).toBeVisible();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(1);
    await expect(canvas.getByRole("heading", { level: 3, name: "Human" })).toBeVisible();
  },
};

export const ResolvedVitals: Story = {
  args: { incident: RESOLVED_VITALS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("listitem")).toHaveLength(5);
    await expect(canvas.getByRole("link", { name: /pull\/184/ })).toBeVisible();
    await expect(canvas.getByText(/12,400 tokens in/)).toBeVisible();
  },
};

export const LongPath: Story = {
  args: { incident: LONG_PATH_INCIDENT },
};
