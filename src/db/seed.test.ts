// The seed is run by humans, Playwright, and demo-mode cold starts. What
// matters: it produces a believable data set (traffic plus the M12 incident
// fixtures), and re-running it changes nothing.
import { count, countDistinct, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { rateMetric } from "@/vitals/metrics";
import { makeDb, type Db } from "./index";
import { checks, metricEvents, pageviews, sessions, sites } from "./schema";
import { DASHBOARD_SITE, DASHBOARD_WRITE_KEY, DEMO_SITE, DEMO_WRITE_KEY, seed } from "./seed";

const countAll = (db: Db) => ({
  sites: db.select({ n: count() }).from(sites).get()?.n,
  sessions: db.select({ n: count() }).from(sessions).get()?.n,
  pageviews: db.select({ n: count() }).from(pageviews).get()?.n,
  metricEvents: db.select({ n: count() }).from(metricEvents).get()?.n,
  checks: db.select({ n: count() }).from(checks).get()?.n,
  paths: db.select({ n: countDistinct(pageviews.path) }).from(pageviews).get()?.n,
});

describe("synthetic seed", () => {
  it("fills the demo site with sessions across many paths plus check history, and running it twice changes nothing", () => {
    const db = makeDb(":memory:");

    seed(db);
    const afterFirstRun = countAll(db);

    expect(afterFirstRun.sites).toBe(2);
    expect(afterFirstRun.sessions).toBeGreaterThanOrEqual(40);
    expect(afterFirstRun.paths).toBeGreaterThanOrEqual(8);
    expect(afterFirstRun.metricEvents).toBeGreaterThan(afterFirstRun.pageviews ?? 0);
    expect(afterFirstRun.checks).toBeGreaterThan(0);

    // An hour later the check fixture would stamp different observed_at values; it must still not be re-planted.
    seed(db, Date.now() + 60 * 60 * 1000);
    expect(countAll(db)).toEqual(afterFirstRun);
  });

  it("gives both sites their write keys, also on a database seeded before keys existed, without renaming them", () => {
    const db = makeDb(":memory:");
    db.insert(sites).values({ id: DEMO_SITE.id, name: "Renamed by hand", createdAt: 1 }).run();

    seed(db);

    const byId = new Map(db.select().from(sites).all().map((site) => [site.id, site]));
    expect(byId.get(DEMO_SITE.id)).toMatchObject({ name: "Renamed by hand", createdAt: 1, writeKey: DEMO_WRITE_KEY });
    expect(byId.get(DASHBOARD_SITE.id)).toMatchObject({ name: DASHBOARD_SITE.name, writeKey: DASHBOARD_WRITE_KEY });
    expect(db.select({ n: count() }).from(checks).where(eq(checks.siteId, DASHBOARD_SITE.id)).get()?.n).toBe(0);
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
