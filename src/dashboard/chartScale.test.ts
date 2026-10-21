// The axis arithmetic the chart relies on: round ticks that end at or above
// the data, and a tick count chosen so a maximum just past a round number does
// not double the axis.
import { describe, expect, it } from "vitest";
import { buildFittedTicks, buildTicks } from "./chartScale";

describe("buildTicks", () => {
  it("starts at zero, steps by a round number, and ends at or above the maximum", () => {
    expect(buildTicks({ max: 7400, count: 4 })).toEqual([0, 2500, 5000, 7500]);
    expect(buildTicks({ max: 0.42, count: 4 })).toEqual([0, 0.2, 0.4, 0.6]);
  });
});

describe("buildFittedTicks", () => {
  it("adds a tick rather than doubling the axis when the maximum just passes a round number", () => {
    // Four ticks over 7,600 would step by 5,000 and top out at 15,000.
    expect(buildFittedTicks({ max: 7600, minCount: 4, maxCount: 6 })).toEqual([0, 2000, 4000, 6000, 8000]);
  });

  it("keeps the fewer ticks when more would not tighten the top", () => {
    expect(buildFittedTicks({ max: 7400, minCount: 4, maxCount: 6 })).toEqual([0, 2500, 5000, 7500]);
  });
});
