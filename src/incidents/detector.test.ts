// The detection rules are the product: a wrong threshold wakes people for
// noise or sleeps through a regression. Each row is one rule read back from
// the README decision entry, on inputs small enough to check by hand.
import { describe, expect, it } from "vitest";
import type { CheckStatus } from "@/checks/status";
import type { MetricName } from "@/vitals/metrics";
import { DETECTION_RULES, findCheckFailures, findVitalsRegressions, type MetricWindow } from "./detector";

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);
const { windowMs, minSampleCount } = DETECTION_RULES;

const window = ({
  to,
  metric,
  p75,
  sampleCount = minSampleCount,
}: {
  to: number;
  metric: MetricName;
  p75: number;
  sampleCount?: number;
}): MetricWindow => ({
  from: to - windowMs,
  to,
  rows: [{ path: "/a", metric, p75, sampleCount }],
});

describe("findVitalsRegressions", () => {
  // LCP bands: good <= 2500, needs-improvement <= 4000, poor above.
  it.each([
    { label: "fires on exactly +50% inside the same band", baseline: 1000, current: 1500, fires: true },
    { label: "fires on exactly +20% when the band worsens", baseline: 2400, current: 2880, fires: true },
    { label: "stays quiet on +25% inside the same band", baseline: 1000, current: 1250, fires: false },
    { label: "stays quiet on a worse band with under +20%", baseline: 2400, current: 2600, fires: false },
    {
      label: "stays quiet on +300% when the baseline is under the sample floor",
      baseline: 1000,
      current: 4000,
      baselineSamples: minSampleCount - 1,
      fires: false,
    },
    {
      label: "stays quiet on +300% when the current window is under the sample floor",
      baseline: 1000,
      current: 4000,
      currentSamples: minSampleCount - 1,
      fires: false,
    },
  ])("$label", ({ baseline, current, baselineSamples, currentSamples, fires }) => {
    const findings = findVitalsRegressions({
      baseline: window({ to: NOW - windowMs, metric: "LCP", p75: baseline, sampleCount: baselineSamples }),
      current: window({ to: NOW, metric: "LCP", p75: current, sampleCount: currentSamples }),
      rules: DETECTION_RULES,
    });

    if (!fires) {
      expect(findings).toEqual([]);
      return;
    }
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      kind: "web-vitals",
      path: "/a",
      metric: "LCP",
      baseline: { from: NOW - 2 * windowMs, to: NOW - windowMs, p75: baseline },
      current: { from: NOW - windowMs, to: NOW, p75: current },
    });
    expect(findings[0].relativeIncrease).toBeCloseTo((current - baseline) / baseline, 10);
  });

  it("does not judge a pair whose baseline p75 is zero, which would otherwise store an infinite increase", () => {
    const findings = findVitalsRegressions({
      baseline: window({ to: NOW - windowMs, metric: "CLS", p75: 0 }),
      current: window({ to: NOW, metric: "CLS", p75: 0.3 }),
      rules: DETECTION_RULES,
    });

    expect(findings).toEqual([]);
  });
});

const observation = ({
  checkId = "api",
  status,
  minutesAgo,
}: {
  checkId?: string;
  status: CheckStatus;
  minutesAgo: number;
}) => ({
  checkId,
  name: `Check ${checkId}`,
  status,
  value: null,
  unit: null,
  observedAt: NOW - minutesAgo * 60_000,
  detail: status === "ok" ? null : `was ${status}`,
});

describe("findCheckFailures", () => {
  it.each([
    {
      label: "fires on the first FAILING observation",
      history: [
        observation({ status: "ok", minutesAgo: 10 }),
        observation({ status: "ok", minutesAgo: 5 }),
        observation({ status: "failing", minutesAgo: 0 }),
      ],
      expected: [{ checkId: "api", status: "failing", consecutive: 1, previousStatus: "ok", observedAt: NOW }],
    },
    {
      label: "stays quiet on DEGRADED twice in a row",
      history: [
        observation({ status: "ok", minutesAgo: 10 }),
        observation({ status: "degraded", minutesAgo: 5 }),
        observation({ status: "degraded", minutesAgo: 0 }),
      ],
      expected: [],
    },
    {
      label: "fires on DEGRADED three times in a row",
      history: [
        observation({ status: "ok", minutesAgo: 15 }),
        observation({ status: "degraded", minutesAgo: 10 }),
        observation({ status: "degraded", minutesAgo: 5 }),
        observation({ status: "degraded", minutesAgo: 0 }),
      ],
      expected: [{ checkId: "api", status: "degraded", consecutive: 3, previousStatus: "ok" }],
    },
    {
      label: "never fires while the latest observation is OK, whatever came before",
      history: [
        observation({ status: "failing", minutesAgo: 10 }),
        observation({ status: "failing", minutesAgo: 5 }),
        observation({ status: "ok", minutesAgo: 0 }),
      ],
      expected: [],
    },
    {
      label: "judges each check by its own newest observation, however the rows are ordered",
      history: [
        observation({ checkId: "queue", status: "failing", minutesAgo: 0 }),
        observation({ checkId: "api", status: "failing", minutesAgo: 0 }),
        observation({ checkId: "api", status: "failing", minutesAgo: 5 }),
        observation({ checkId: "queue", status: "ok", minutesAgo: 5 }),
        observation({ checkId: "api", status: "ok", minutesAgo: 10 }),
      ],
      expected: [
        { checkId: "api", status: "failing", consecutive: 2, previousStatus: "ok" },
        { checkId: "queue", status: "failing", consecutive: 1, previousStatus: "ok" },
      ],
    },
    {
      label: "reports no previous status when the check has only ever been failing",
      history: [observation({ status: "failing", minutesAgo: 5 }), observation({ status: "failing", minutesAgo: 0 })],
      expected: [{ checkId: "api", status: "failing", consecutive: 2, previousStatus: null }],
    },
  ])("$label", ({ history, expected }) => {
    const findings = findCheckFailures({ observations: history, rules: DETECTION_RULES });

    expect(findings).toHaveLength(expected.length);
    expect(findings).toMatchObject(expected.map((finding) => ({ kind: "health-check", ...finding })));
  });
});
