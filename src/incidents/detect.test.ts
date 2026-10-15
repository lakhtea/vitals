// Detection against the real seed, the way `npm run incidents:detect` and the
// demo cold start run it. What matters: the planted regression and failing
// check open exactly two incidents, re-running changes nothing, human
// decisions are never overwritten, and an incident resolves only when the
// data shows it has cleared.
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { makeDb, type Db } from "@/db";
import { checks, incidents, metricEvents, pageviews, sessions } from "@/db/schema";
import { DEMO_SITE, seed, seedStress } from "@/db/seed";
import { DEMO_CHECKS } from "@/db/synthetic/checks";
import { detectIncidents, detectIncidentsForAllSites } from "./detect";
import { REGRESSION_FIXTURE } from "@/db/synthetic/regression";
import { rateMetric } from "@/vitals/metrics";
import { DETECTION_RULES } from "./detector";

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const { windowMs } = DETECTION_RULES;

let db: Db;

const listIncidents = () => db.select().from(incidents).orderBy(asc(incidents.id)).all();

const detectAt = (now: number) => detectIncidents({ db, siteId: DEMO_SITE.id, now });

/** Thirty /pricing loads with the given LCP, spread across [from, from + windowMs), as later traffic would arrive. */
const addPricingLcp = ({ label, from, lcp }: { label: string; from: number; lcp: number }): void => {
  const visits = 30;
  const step = Math.floor(windowMs / (visits + 1));
  for (let index = 0; index < visits; index += 1) {
    const startedAt = from + step * (index + 1);
    const sessionId = `test-${label}-s${index}`;
    const pageviewId = `${sessionId}-p0`;
    db.insert(sessions)
      .values({ id: sessionId, siteId: DEMO_SITE.id, startedAt, deviceClass: "desktop", connectionType: "4g", userAgentFamily: "Chrome" })
      .run();
    db.insert(pageviews).values({ id: pageviewId, sessionId, path: REGRESSION_FIXTURE.path, startedAt }).run();
    db.insert(metricEvents)
      .values({ pageviewId, metricId: `${pageviewId}-LCP`, name: "LCP", value: lcp, rating: rateMetric({ name: "LCP", value: lcp }), recordedAt: startedAt + lcp })
      .run();
  }
};

const SLOW_LCP_MS = 7_000;
const RECOVERED_LCP_MS = 2_000;

beforeEach(() => {
  db = makeDb(":memory:");
  seed(db, NOW);
});

describe("detectIncidents on the seeded demo", () => {
  it("opens exactly the planted LCP regression and the failing API check, and a re-run changes nothing", () => {
    expect(detectAt(NOW)).toEqual({ opened: 2, resolved: 0, unchanged: 0 });

    const firstRun = listIncidents();
    expect(firstRun).toMatchObject([
      {
        source: "web-vitals",
        subject: "/pricing",
        metric: "LCP",
        status: "open",
        detectedAt: NOW,
        resolvedAt: null,
        evidence: { kind: "web-vitals", path: "/pricing", metric: "LCP", current: { rating: "poor" } },
      },
      {
        source: "health-check",
        subject: DEMO_CHECKS.apiHealth.checkId,
        metric: null,
        status: "open",
        detectedAt: NOW,
        resolvedAt: null,
        evidence: { kind: "health-check", status: "failing", previousStatus: "ok", consecutive: 2 },
      },
    ]);
    const regression = firstRun[0].evidence;
    if (regression.kind !== "web-vitals") {
      throw new Error("expected vitals evidence");
    }
    expect(regression.relativeIncrease).toBeGreaterThanOrEqual(DETECTION_RULES.majorRelativeIncrease);
    expect(regression.baseline.sampleCount).toBeGreaterThanOrEqual(DETECTION_RULES.minSampleCount);
    expect(regression.current.sampleCount).toBeGreaterThanOrEqual(DETECTION_RULES.minSampleCount);

    expect(detectAt(NOW + 5 * MINUTE_MS)).toEqual({ opened: 0, resolved: 0, unchanged: 2 });
    expect(listIncidents()).toEqual(firstRun);
  });

  it("resolves a check incident once the check reports OK again, and leaves an approved incident to the human", () => {
    detectAt(NOW);
    const [regression, apiFailure] = listIncidents();
    db.update(incidents)
      .set({ status: "approved", note: "ship the image fix", updatedAt: NOW + MINUTE_MS })
      .where(eq(incidents.id, regression.id))
      .run();
    db.insert(checks)
      .values({ siteId: DEMO_SITE.id, ...DEMO_CHECKS.apiHealth, status: "ok", observedAt: NOW + 5 * MINUTE_MS })
      .run();

    const result = detectAt(NOW + 10 * MINUTE_MS);

    expect(result).toEqual({ opened: 0, resolved: 1, unchanged: 1 });
    const afterRecovery = listIncidents();
    expect(afterRecovery).toHaveLength(2);
    expect(afterRecovery.find((incident) => incident.id === apiFailure.id)).toMatchObject({
      status: "resolved",
      resolvedAt: NOW + 10 * MINUTE_MS,
      updatedAt: NOW + 10 * MINUTE_MS,
    });
    // Still regressed, but approved: not the detector's to touch, and not a second incident either.
    const approvedUntouched = {
      status: "approved",
      note: "ship the image fix",
      resolvedAt: null,
      updatedAt: NOW + MINUTE_MS,
    };
    expect(afterRecovery.find((incident) => incident.id === regression.id)).toMatchObject(approvedUntouched);

    // A full window later the regression no longer registers either; resolving an approved incident is the
    // fix pipeline's job when the fix lands, never the detector's, and it is not counted as detector work.
    expect(detectAt(NOW + windowMs)).toEqual({ opened: 0, resolved: 0, unchanged: 0 });
    expect(listIncidents().find((incident) => incident.id === regression.id)).toMatchObject(approvedUntouched);
  });

  it("honours a dismissal for one full window, then treats the same subject as news again", () => {
    detectAt(NOW);
    const [regression, apiFailure] = listIncidents();
    db.update(incidents)
      .set({ status: "dismissed", note: "known outage", updatedAt: NOW + MINUTE_MS })
      .where(eq(incidents.id, apiFailure.id))
      .run();

    // The check is still failing, but the human has spoken.
    expect(detectAt(NOW + HOUR_MS)).toEqual({ opened: 0, resolved: 0, unchanged: 2 });
    expect(listIncidents()).toHaveLength(2);
    expect(listIncidents().find((incident) => incident.id === apiFailure.id)).toMatchObject({
      status: "dismissed",
      note: "known outage",
      updatedAt: NOW + MINUTE_MS,
      resolvedAt: null,
    });

    // A window later the dismissal has expired and the check is still failing, so a fresh incident opens
    // beside the dismissed one. The regression has no new /pricing data to judge, so it stays open.
    expect(detectAt(NOW + MINUTE_MS + windowMs)).toEqual({ opened: 1, resolved: 0, unchanged: 1 });
    const later = listIncidents();
    expect(later).toHaveLength(3);
    expect(later.find((incident) => incident.id === apiFailure.id)?.status).toBe("dismissed");
    expect(later.find((incident) => incident.id === regression.id)).toMatchObject({ status: "open", resolvedAt: null });
    expect(later[2]).toMatchObject({ subject: DEMO_CHECKS.apiHealth.checkId, status: "open", detectedAt: NOW + MINUTE_MS + windowMs });
  });

  it("keeps a vitals incident open while there is no data to show a recovery", () => {
    detectAt(NOW);
    const [regression] = listIncidents();

    // Half a day on, and a full day on, the current window holds too few /pricing visits to judge.
    expect(detectAt(NOW + 12 * HOUR_MS)).toEqual({ opened: 0, resolved: 0, unchanged: 2 });
    expect(detectAt(NOW + windowMs)).toEqual({ opened: 0, resolved: 0, unchanged: 2 });
    expect(listIncidents().find((incident) => incident.id === regression.id)).toMatchObject({
      status: "open",
      resolvedAt: null,
      updatedAt: NOW,
    });
  });

  it("keeps a regression open after the rolling baseline has caught up with it, while the page is still slow", () => {
    detectAt(NOW);
    const [regression] = listIncidents();
    addPricingLcp({ label: "slow-day-1", from: NOW, lcp: SLOW_LCP_MS });
    addPricingLcp({ label: "slow-day-2", from: NOW + windowMs, lcp: SLOW_LCP_MS });

    // Two slow days in a row: the two-window comparison is quiet, but the page never got better.
    expect(detectAt(NOW + 2 * windowMs)).toEqual({ opened: 0, resolved: 0, unchanged: 2 });
    expect(listIncidents().find((incident) => incident.id === regression.id)?.status).toBe("open");
  });

  it("resolves a regression once a full window shows the p75 back near the baseline it was detected against", () => {
    detectAt(NOW);
    const [regression] = listIncidents();
    addPricingLcp({ label: "recovered", from: NOW + windowMs, lcp: RECOVERED_LCP_MS });

    expect(detectAt(NOW + 2 * windowMs)).toEqual({ opened: 0, resolved: 1, unchanged: 1 });
    expect(listIncidents().find((incident) => incident.id === regression.id)).toMatchObject({
      status: "resolved",
      resolvedAt: NOW + 2 * windowMs,
    });
  });

  it("runs every site and sums the result", () => {
    expect(detectIncidentsForAllSites({ db, now: NOW })).toEqual({ opened: 2, resolved: 0, unchanged: 0 });
  });
});

describe("detectIncidents on the stress seed", () => {
  // Seeds about 100,000 events: 1.2 s locally, 5.8 s on a CI runner with coverage on, so it gets its own budget.
  it("opens nothing: the benchmark data set is detector-clean", { timeout: 30_000 }, () => {
    const stressDb = makeDb(":memory:");
    seedStress(stressDb, NOW);

    expect(detectIncidents({ db: stressDb, siteId: DEMO_SITE.id, now: NOW })).toEqual({
      opened: 0,
      resolved: 0,
      unchanged: 0,
    });
    expect(stressDb.select().from(incidents).all()).toEqual([]);
  });
});
