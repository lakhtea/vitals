// The fields the page-detail view and the dashboard chart read: time-bucketed
// p75 series, one page by path, the sessions that visited it, and its
// device/connection breakdown. Pinned on a dataset small enough to check by
// hand, then the query cost of the detail operation on the demo seed.
import { graphql } from "graphql";
import { describe, expect, it } from "vitest";
import { makeDb, type Db } from "@/db";
import { createQueryCounter } from "@/db/query-counter";
import { metricEvents, pageviews, sessions, sites } from "@/db/schema";
import { seed } from "@/db/seed";
import type { Context } from "./context";
import { schema } from "./schema";

const exec = (db: Db, source: string, variableValues?: Record<string, unknown>) => {
  const contextValue: Context = { db, isService: false };
  return graphql({ schema, source, contextValue, variableValues });
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** A whole number of days after the epoch, so it is also the start of its DAY bucket. */
const BASE = 20 * DAY;

interface SeriesPoint {
  from: string;
  p75: number;
  sampleCount: number;
}

interface MetricSeries {
  name: string;
  points: SeriesPoint[];
}

interface BreakdownRow {
  value: string;
  metrics: Array<{ name: string; p75: number; sampleCount: number }>;
}

/**
 * Three desktop/4g pageviews on "/a" in the first day (LCP 1000, 2000, 3000, one
 * CLS), one mobile/4g pageview on "/a" 30 hours later (LCP 4000), and one
 * desktop/3g session that only ever saw "/b".
 */
const insertHandVerifiableFixture = (db: Db): void => {
  db.insert(sites).values({ id: "t", name: "T", createdAt: BASE }).run();
  db.insert(sessions)
    .values([
      { id: "s1", siteId: "t", startedAt: BASE, deviceClass: "desktop", connectionType: "4g", userAgentFamily: "x" },
      { id: "s2", siteId: "t", startedAt: BASE + 30 * HOUR, deviceClass: "mobile", connectionType: "4g", userAgentFamily: "x" },
      { id: "s3", siteId: "t", startedAt: BASE + HOUR, deviceClass: "desktop", connectionType: "3g", userAgentFamily: "x" },
    ])
    .run();
  db.insert(pageviews)
    .values([
      { id: "p1", sessionId: "s1", path: "/a", startedAt: BASE },
      { id: "p2", sessionId: "s1", path: "/a", startedAt: BASE + HOUR },
      { id: "p3", sessionId: "s1", path: "/a", startedAt: BASE + 2 * HOUR },
      { id: "p4", sessionId: "s2", path: "/a", startedAt: BASE + 30 * HOUR },
      { id: "p5", sessionId: "s3", path: "/b", startedAt: BASE + HOUR },
    ])
    .run();
  const lcp = (pageviewId: string, value: number) => ({
    pageviewId,
    metricId: `lcp-${pageviewId}`,
    name: "LCP" as const,
    value,
    rating: "good" as const,
    recordedAt: BASE,
  });
  db.insert(metricEvents)
    .values([
      lcp("p1", 1000),
      lcp("p2", 2000),
      lcp("p3", 3000),
      lcp("p4", 4000),
      lcp("p5", 9000),
      { pageviewId: "p1", metricId: "cls-p1", name: "CLS", value: 0.05, rating: "good", recordedAt: BASE },
    ])
    .run();
};

const SERIES = `
  query Series($path: String!, $bucket: SeriesBucket!) {
    site(id: "t") {
      series(bucket: $bucket) { name points { from p75 sampleCount } }
      page(path: $path) {
        series(bucket: $bucket) { name points { from p75 sampleCount } }
      }
    }
  }
`;

const PAGE = `
  query Page($path: String!) {
    site(id: "t") {
      page(path: $path) {
        path
        pageviewCount
        eventCount
        sessions { id }
        breakdown {
          byDevice { value metrics { name p75 sampleCount } }
          byConnection { value metrics { name p75 sampleCount } }
        }
      }
    }
  }
`;

describe("Site.series and Page.series", () => {
  it("buckets samples by the pageview's start time and takes the nearest-rank p75 of each bucket", async () => {
    const db = makeDb(":memory:");
    insertHandVerifiableFixture(db);

    const result = await exec(db, SERIES, { path: "/a", bucket: "DAY" });

    expect(result.errors).toBeUndefined();
    const site = result.data?.site as { series: MetricSeries[]; page: { series: MetricSeries[] } };
    expect(site.page.series.map((series) => series.name)).toEqual(["LCP", "CLS", "INP", "TTFB", "FCP"]);
    // p1..p3 fall in the first day (rank ceil(0.75 * 3) = 3 -> 3000); p4, 30 h later, in the next.
    expect(site.page.series.find((series) => series.name === "LCP")?.points).toEqual([
      { from: new Date(BASE).toISOString(), p75: 3000, sampleCount: 3 },
      { from: new Date(BASE + DAY).toISOString(), p75: 4000, sampleCount: 1 },
    ]);
    expect(site.page.series.find((series) => series.name === "INP")?.points).toEqual([]);
    // The site-wide series also counts "/b"'s 9000 ms LCP: four samples, rank 3 is still 3000.
    expect(site.series.find((series) => series.name === "LCP")?.points[0]).toEqual({
      from: new Date(BASE).toISOString(),
      p75: 3000,
      sampleCount: 4,
    });
  });
});

describe("Site.page", () => {
  it("returns the page's aggregate for a known path and null for a path with no traffic", async () => {
    const db = makeDb(":memory:");
    insertHandVerifiableFixture(db);

    const known = await exec(db, PAGE, { path: "/a" });
    const unknown = await exec(db, PAGE, { path: "/nope" });

    expect(known.errors).toBeUndefined();
    expect(known.data?.site).toMatchObject({ page: { path: "/a", pageviewCount: 4, eventCount: 5 } });
    expect(unknown.errors).toBeUndefined();
    expect(unknown.data?.site).toEqual({ page: null });
  });

  it("lists only the sessions that visited the path, most recent first", async () => {
    const db = makeDb(":memory:");
    insertHandVerifiableFixture(db);

    const result = await exec(db, PAGE, { path: "/a" });

    const page = (result.data?.site as { page: { sessions: Array<{ id: string }> } }).page;
    expect(page.sessions).toEqual([{ id: "s2" }, { id: "s1" }]);
  });

  it("breaks the path down by device and connection, omitting values with no samples", async () => {
    const db = makeDb(":memory:");
    insertHandVerifiableFixture(db);

    const result = await exec(db, PAGE, { path: "/a" });

    const breakdown = (result.data?.site as { page: { breakdown: { byDevice: BreakdownRow[]; byConnection: BreakdownRow[] } } })
      .page.breakdown;
    expect(breakdown.byDevice.map((row) => row.value)).toEqual(["DESKTOP", "MOBILE"]);
    expect(breakdown.byDevice[0].metrics.find((metric) => metric.name === "LCP")).toMatchObject({ p75: 3000, sampleCount: 3 });
    expect(breakdown.byDevice[0].metrics.find((metric) => metric.name === "CLS")).toMatchObject({ sampleCount: 1 });
    expect(breakdown.byDevice[1].metrics).toEqual([{ name: "LCP", p75: 4000, sampleCount: 1 }]);
    // s3 is on 3g but only visited "/b", so THREE_G has no samples here; every "/a" sample is on 4g.
    expect(breakdown.byConnection.map((row) => row.value)).toEqual(["FOUR_G"]);
    expect(breakdown.byConnection[0].metrics.find((metric) => metric.name === "LCP")).toMatchObject({ p75: 3000, sampleCount: 4 });
    expect(breakdown.byConnection[0].metrics.find((metric) => metric.name === "CLS")).toMatchObject({ sampleCount: 1 });
  });
});

describe("query cost of the page-detail operation", () => {
  // Measured with the committed QueryCounter; the README metrics table quotes this test.
  it("loads a page's summary, series, breakdown, and sessions with a fixed number of SQL statements", async () => {
    const counter = createQueryCounter();
    const db = makeDb(":memory:", { logger: counter.logger });
    seed(db);
    counter.reset();

    const result = await exec(
      db,
      `{
        site(id: "demo") {
          page(path: "/pricing") {
            path
            metrics { name p75 }
            series(bucket: SIX_HOURS) { name points { from p75 } }
            breakdown { byDevice { value metrics { name p75 } } byConnection { value metrics { name p75 } } }
            sessions(limit: 20) { id pageviews { path } }
          }
        }
      }`,
    );

    expect(result.errors).toBeUndefined();
    const page = (result.data?.site as { page: { sessions: unknown[] } }).page;
    expect(page.sessions).toHaveLength(20);
    // 1 (site) + 1 (page) + 1 (metrics) + 1 (series) + 2 (breakdown, one per
    // dimension) + 1 (sessions) + 1 (pageviews for all 20 sessions).
    expect(counter.count()).toBe(8);
  });
});
