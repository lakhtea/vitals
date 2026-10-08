// Guards the one rule the whole dashboard hangs on: thresholds are inclusive
// at the "good" and "needs-improvement" edges, exactly as web.dev defines them.
import { describe, expect, it } from "vitest";
import { METRIC_THRESHOLDS, rateMetric } from "./metrics";

describe("rateMetric", () => {
  it("is inclusive at both thresholds for every metric", () => {
    for (const name of ["LCP", "CLS", "INP", "TTFB", "FCP"] as const) {
      const [good, needsImprovement] = METRIC_THRESHOLDS[name];
      expect(rateMetric({ name, value: good })).toBe("good");
      expect(rateMetric({ name, value: needsImprovement })).toBe("needs-improvement");
      expect(rateMetric({ name, value: needsImprovement + 0.01 })).toBe("poor");
    }
  });
});
