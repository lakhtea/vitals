// The two sentences a person reads first about an incident: its title and its
// one line of evidence. They are composed from several formatters, so a change
// to any of them shows up here before it shows up on the on-call screen.
import { describe, expect, it } from "vitest";
import type { CheckEvidence, VitalsEvidence } from "@/incidents/evidence";
import { describeEvidence, incidentTitle } from "./incidents";

const vitals: VitalsEvidence = {
  kind: "web-vitals",
  path: "/pricing",
  metric: "LCP",
  baseline: { from: 0, to: 1, p75: 2600, sampleCount: 31, rating: "needs-improvement" },
  current: { from: 1, to: 2, p75: 6500, sampleCount: 29, rating: "poor" },
  relativeIncrease: 1.5,
};

const check: CheckEvidence = {
  kind: "health-check",
  checkId: "api-health",
  name: "API health",
  status: "failing",
  previousStatus: "ok",
  consecutive: 2,
  value: null,
  unit: null,
  observedAt: 0,
  detail: "HTTP 503 from /healthz",
};

describe("incident title and evidence line", () => {
  it("names a vitals regression by metric and path, and states both p75s, the change, and the samples", () => {
    expect(incidentTitle({ source: "web-vitals", subject: "/pricing", metric: "LCP", evidence: vitals })).toBe(
      "LCP on /pricing",
    );
    expect(describeEvidence(vitals)).toBe("p75 2.6 s to 6.5 s (+150%), 31 and 29 samples");
  });

  it("names a failing check by its own name, and states the streak, what it was before, and its detail", () => {
    expect(incidentTitle({ source: "health-check", subject: "api-health", metric: null, evidence: check })).toBe(
      "API health",
    );
    expect(describeEvidence(check)).toBe("Failing for 2 observations (was OK): HTTP 503 from /healthz");
    expect(describeEvidence({ ...check, previousStatus: null, consecutive: 1, detail: null })).toBe(
      "Failing for 1 observation",
    );
  });
});
