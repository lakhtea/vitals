// The page detail reads its filters from the URL, which anyone can type. These
// prove the boundary: a valid URL becomes the filters it names, garbage
// becomes the defaults rather than an error, and the URL the filter bar
// writes is one the route reads back unchanged.
import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, TIME_RANGE_OPTIONS, type DashboardFilters } from "./filters";
import { parsePageDetailSearchParams } from "./pageDetail";
import { toFilterSearchParams } from "./routes";

describe("parsePageDetailSearchParams", () => {
  it("reads a fully specified URL", () => {
    expect(parsePageDetailSearchParams({ range: "24h", device: "MOBILE", connection: "FOUR_G" })).toEqual({
      range: "24h",
      deviceClass: "MOBILE",
      connectionType: "FOUR_G",
    });
  });

  it("falls back to the defaults for garbage and repeated values instead of failing", () => {
    expect(
      parsePageDetailSearchParams({
        range: "yesterday",
        device: ["MOBILE", "DESKTOP"],
        connection: "<script>",
        unrelated: "ignored",
      }),
    ).toEqual(DEFAULT_FILTERS);
    expect(parsePageDetailSearchParams({})).toEqual(DEFAULT_FILTERS);
  });

  it("ignores an unknown device while keeping the valid range beside it", () => {
    expect(parsePageDetailSearchParams({ range: "all", device: "WATCH" })).toEqual({
      range: "all",
      deviceClass: null,
      connectionType: null,
    });
  });

  it("reads back exactly what the filter bar writes", () => {
    const filters: DashboardFilters = { range: "30d", deviceClass: "TABLET", connectionType: "SLOW_2G" };
    const written = Object.fromEntries(toFilterSearchParams(filters));
    expect(parsePageDetailSearchParams(written)).toEqual(filters);
  });

  it("accepts every time range the filter bar offers, so a new range cannot be silently dropped", () => {
    for (const option of TIME_RANGE_OPTIONS) {
      const written = Object.fromEntries(toFilterSearchParams({ ...DEFAULT_FILTERS, range: option.key }));
      expect(parsePageDetailSearchParams(written).range).toBe(option.key);
    }
  });
});
