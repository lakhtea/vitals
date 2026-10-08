// The percentile and bucket maths is the product; pin it on a dataset small
// enough to verify by hand, then pin the query cost of the operation the
// dashboard will run most, which is the whole point of M4.
import { graphql } from "graphql";
import { describe, expect, it } from "vitest";
import { makeDb, type Db } from "@/db";
import { createQueryCounter } from "@/db/query-counter";
import { metricEvents, pageviews, sessions, sites } from "@/db/schema";
import { seed } from "@/db/seed";
import type { Context } from "./context";
import { schema } from "./schema";

const exec = (db: Db, source: string, variableValues?: Record<string, unknown>) => {
  const contextValue: Context = { db };
  return graphql({ schema, source, contextValue, variableValues });
};

interface MetricSummary {
  name: string;
  sampleCount: number;
  p50: number;
  p75: number;
  p90: number;
  p75Rating: string;
  buckets: { good: number; needsImprovement: number; poor: number };
}

interface PageWithMetrics {
  path: string;
  metrics: MetricSummary[];
}

/** Five LCPs on "/a" at 1000..5000 ms, one CLS, and an empty page "/b". */
const insertHandVerifiableFixture = (db: Db): void => {
  const t = 1_000;
  db.insert(sites).values({ id: "t", name: "T", createdAt: t }).run();
  db.insert(sessions)
    .values({ id: "s", siteId: "t", startedAt: t, deviceClass: "desktop", connectionType: "4g", userAgentFamily: "x" })
    .run();
  const lcpValues = [1000, 2000, 3000, 4000, 5000];
  db.insert(pageviews)
    .values([
      ...lcpValues.map((_value, i) => ({ id: `p${i}`, sessionId: "s", path: "/a", startedAt: t })),
      { id: "p-empty", sessionId: "s", path: "/b", startedAt: t },
    ])
    .run();
  db.insert(metricEvents)
    .values([
      ...lcpValues.map((value, i) => ({
        pageviewId: `p${i}`,
        metricId: `lcp${i}`,
        name: "LCP" as const,
        value,
        rating: value <= 2500 ? ("good" as const) : value <= 4000 ? ("needs-improvement" as const) : ("poor" as const),
        recordedAt: value,
      })),
      { pageviewId: "p0", metricId: "cls0", name: "CLS" as const, value: 0.05, rating: "good" as const, recordedAt: 1500 },
    ])
    .run();
};

const PAGE_METRICS = `
  query PageMetrics($from: DateTime, $to: DateTime) {
    site(id: "t") {
      pages {
        path
        metrics(from: $from, to: $to) {
          name sampleCount p50 p75 p90 p75Rating
          buckets { good needsImprovement poor }
        }
      }
      metrics(from: $from, to: $to) { name p75 sampleCount }
    }
  }
`;

describe("Page.metrics and Site.metrics", () => {
  it("computes nearest-rank percentiles, the p75 rating, and rating buckets per page and per site", async () => {
    const db = makeDb(":memory:");
    insertHandVerifiableFixture(db);

    const result = await exec(db, PAGE_METRICS);

    expect(result.errors).toBeUndefined();
    const site = result.data?.site as { pages: PageWithMetrics[]; metrics: MetricSummary[] };
    const pageA = site.pages.find((page) => page.path === "/a");
    const pageB = site.pages.find((page) => page.path === "/b");

    expect(pageA?.metrics.find((metric) => metric.name === "LCP")).toEqual({
      name: "LCP",
      sampleCount: 5,
      p50: 3000,
      p75: 4000,
      p90: 5000,
      p75Rating: "NEEDS_IMPROVEMENT",
      buckets: { good: 2, needsImprovement: 2, poor: 1 },
    });
    expect(pageA?.metrics.find((metric) => metric.name === "CLS")).toMatchObject({
      sampleCount: 1,
      p75: 0.05,
      p75Rating: "GOOD",
    });
    expect(pageB?.metrics).toEqual([]);
    expect(site.metrics.find((metric) => metric.name === "LCP")).toMatchObject({ p75: 4000, sampleCount: 5 });
  });

  it("applies the time range as half-open [from, to) on recordedAt", async () => {
    const db = makeDb(":memory:");
    insertHandVerifiableFixture(db);

    const result = await exec(db, PAGE_METRICS, {
      from: new Date(2000).toISOString(),
      to: new Date(4000).toISOString(),
    });

    expect(result.errors).toBeUndefined();
    const site = result.data?.site as { pages: PageWithMetrics[] };
    const lcp = site.pages.find((page) => page.path === "/a")?.metrics.find((metric) => metric.name === "LCP");
    expect(lcp).toMatchObject({ sampleCount: 2, p50: 2000, p75: 3000 });
  });

  it("rejects a malformed DateTime argument instead of silently ignoring it", async () => {
    const db = makeDb(":memory:");
    insertHandVerifiableFixture(db);

    const result = await exec(db, PAGE_METRICS, { from: "yesterday" });

    expect(result.errors?.[0]?.message).toMatch(/DateTime/);
  });
});

describe("query cost of the dashboard's main operation", () => {
  // Measured with the committed QueryCounter; the README metrics table quotes this test.
  it("loads every page's metrics for a site with a fixed number of SQL statements", async () => {
    const counter = createQueryCounter();
    const db = makeDb(":memory:", { logger: counter.logger });
    seed(db);
    counter.reset();

    const result = await exec(db, `{ site(id: "demo") { pages { path metrics { name p75 } } } }`);

    expect(result.errors).toBeUndefined();
    const pageCount = (result.data?.site as { pages: unknown[] }).pages.length;
    expect(pageCount).toBeGreaterThanOrEqual(8);
    // Naive implementation: 1 (site) + 1 (pages) + one metrics query per page.
    expect(counter.count()).toBe(2 + pageCount);
  });
});
