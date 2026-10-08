// The sample-count wording the cards and the self-measurement panel share:
// singular at exactly one, grouped thousands otherwise.
import { describe, expect, it } from "vitest";
import { formatSampleCount } from "./format";

describe("formatSampleCount", () => {
  it("uses the singular for exactly one sample", () => {
    expect(formatSampleCount(1)).toBe("1 sample");
  });

  it("uses the plural for zero and for many, with grouped thousands", () => {
    expect(formatSampleCount(0)).toBe("0 samples");
    expect(formatSampleCount(1204)).toBe("1,204 samples");
  });
});
