import { describe, expect, it } from "vitest";
import { visibleRowWindow } from "./rowWindow";

const SIZES = { viewportRows: 14, overscanRows: 10 };

describe("visibleRowWindow", () => {
  it("starts at zero while the overscan would reach above the first row", () => {
    expect(visibleRowWindow({ firstVisibleRow: 3, rowCount: 2000, ...SIZES })).toEqual({ start: 0, end: 27 });
  });

  it("renders the viewport plus overscan on both sides in the middle of the list", () => {
    expect(visibleRowWindow({ firstVisibleRow: 500, rowCount: 2000, ...SIZES })).toEqual({ start: 490, end: 524 });
  });

  it("never reaches past the last row", () => {
    expect(visibleRowWindow({ firstVisibleRow: 1990, rowCount: 2000, ...SIZES })).toEqual({ start: 1980, end: 2000 });
  });

  it("renders every row of a list shorter than one window", () => {
    expect(visibleRowWindow({ firstVisibleRow: 0, rowCount: 6, ...SIZES })).toEqual({ start: 0, end: 6 });
  });

  it("is empty, not inverted, when the list shrank below the scroll position", () => {
    expect(visibleRowWindow({ firstVisibleRow: 1500, rowCount: 50, ...SIZES })).toEqual({ start: 50, end: 50 });
  });
});
