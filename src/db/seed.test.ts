// The seed is run by humans, Playwright, and (later) demo-mode cold starts.
// What matters: it produces a believable data set, and re-running it changes nothing.
import { count, countDistinct } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { rateMetric } from "@/vitals/metrics";
import { makeDb, type Db } from "./index";
import { metricEvents, pageviews, sessions, sites } from "./schema";
import { seed } from "./seed";

const countAll = (db: Db) => ({
  sites: db.select({ n: count() }).from(sites).get()?.n,
  sessions: db.select({ n: count() }).from(sessions).get()?.n,
  pageviews: db.select({ n: count() }).from(pageviews).get()?.n,
  metricEvents: db.select({ n: count() }).from(metricEvents).get()?.n,
  paths: db.select({ n: countDistinct(pageviews.path) }).from(pageviews).get()?.n,
});

describe("synthetic seed", () => {
  it("fills the demo site with sessions across many paths, and running it twice changes nothing", () => {
    const db = makeDb(":memory:");

    seed(db);
    const afterFirstRun = countAll(db);

    expect(afterFirstRun.sites).toBe(2);
    expect(afterFirstRun.sessions).toBeGreaterThanOrEqual(40);
    expect(afterFirstRun.paths).toBeGreaterThanOrEqual(8);
    expect(afterFirstRun.metricEvents).toBeGreaterThan(afterFirstRun.pageviews ?? 0);

    seed(db);
    expect(countAll(db)).toEqual(afterFirstRun);
  });

  it("stores ratings that agree with the web.dev thresholds for every event", () => {
    const db = makeDb(":memory:");
    seed(db);

    const rows = db
      .select({ name: metricEvents.name, value: metricEvents.value, rating: metricEvents.rating })
      .from(metricEvents)
      .all();

    const mismatches = rows.filter((row) => rateMetric(row) !== row.rating);
    expect(mismatches).toEqual([]);
  });
});
