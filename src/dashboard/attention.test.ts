// The attention strip's words come from this table: which incident states
// still count as open, which check states are a problem, and how the counts
// are spelled. The strip itself only renders what these functions return.
import { describe, expect, it } from "vitest";
import { attentionItems, isAllClear, summarizeAttention } from "./attention";

describe("summarizeAttention", () => {
  it("counts every non-terminal incident as open and ignores dismissed and resolved ones", () => {
    const summary = summarizeAttention({
      incidents: [
        { status: "open" },
        { status: "awaiting-human" },
        { status: "approved" },
        { status: "dismissed" },
        { status: "resolved" },
      ],
      checks: [],
    });
    expect(summary.openIncidents).toBe(3);
  });

  it("separates failing from degraded checks and is all clear only when every count is zero", () => {
    const summary = summarizeAttention({
      incidents: [],
      checks: [{ status: "ok" }, { status: "failing" }, { status: "degraded" }, { status: "degraded" }],
    });
    expect(summary).toEqual({ openIncidents: 0, failingChecks: 1, degradedChecks: 2 });
    expect(isAllClear(summary)).toBe(false);
    expect(isAllClear({ openIncidents: 0, failingChecks: 0, degradedChecks: 0 })).toBe(true);
  });
});

describe("attentionItems", () => {
  it("spells each non-zero problem with its count, pluralised, pointing at its section", () => {
    expect(attentionItems({ openIncidents: 2, failingChecks: 1, degradedChecks: 0 })).toEqual([
      { label: "2 open incidents", href: "#incidents" },
      { label: "1 failing check", href: "#health" },
    ]);
  });

  it("returns nothing when all is clear", () => {
    expect(attentionItems({ openIncidents: 0, failingChecks: 0, degradedChecks: 0 })).toEqual([]);
  });
});
