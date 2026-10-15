// Idempotent demo seed: two sites plus deterministic synthetic traffic, inserted
// with ON CONFLICT DO NOTHING so re-running never duplicates rows and real
// ingested data can coexist with it. The demo plan also plants what the M12
// detector is meant to find (one LCP regression, one failing check); the
// stress plan stays detector-clean. `npm run db:seed` runs seed(); `npm run
// db:seed:stress` runs seedStress(), the ~100k-event benchmark data set that
// lives beside it. attachSeededFix() adds the demo's proposed fix once
// detection has opened its incident. The CLI entry is scripts/seed-db.ts.
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { DETECTION_RULES } from "@/incidents/detector";
import { ACTIVE_INCIDENT_STATUSES } from "@/incidents/vocabulary";
import type { Db } from "./index";
import { getLatestFixRevision, submitFixRevision } from "./queries/fix-revisions";
import { checks, incidents, metricEvents, pageviews, sessions, sites } from "./schema";
import { generateCheckObservations } from "./synthetic/checks";
import { SEEDED_FIX, SEEDED_FIX_FILES } from "./synthetic/proposed-fix";
import { generateVitalsRegression } from "./synthetic/regression";
import { generateSyntheticTraffic, type SyntheticTraffic, type TrafficProfileName } from "./synthetic/traffic";

export const DEMO_SITE = { id: "demo", name: "Demo site (synthetic traffic)" } as const;
/** Where the dashboard reports on itself once the browser library (M3) is wired in. */
export const DASHBOARD_SITE = { id: "vitals-dashboard", name: "Vitals dashboard (self-measured)" } as const;

/** Fixed write keys for POST /api/checks, so the local loop needs no configuration. Not secrets: the demo is public. */
export const DEMO_WRITE_KEY = "demo-write-key";
export const DASHBOARD_WRITE_KEY = "vitals-dashboard-write-key";

interface IncidentFixtureSeeds {
  regression: number;
  checks: number;
}

interface SeedPlan {
  label: string;
  profile: TrafficProfileName;
  sessionCount: number;
  randomSeed: number;
  /** How long before `now` the generated traffic ends; 0 means the newest session is right now. */
  trafficEndsBeforeNowMs: number;
  /** The planted regression and check history the detector finds; null plants nothing. */
  incidentFixtures: IncidentFixtureSeeds | null;
}

const DEMO_PLAN: SeedPlan = {
  label: "seed",
  profile: "demo",
  sessionCount: 50,
  randomSeed: 20261007,
  trafficEndsBeforeNowMs: 0,
  incidentFixtures: { regression: 20261014, checks: 20261015 },
};
/**
 * Its own random stream, so the stress set is not the demo set with a longer
 * tail. It ends two detection windows before `now`, so the detector's baseline
 * and current windows never hold benchmark traffic: the set exists to measure
 * query cost, and a stationary random draw of 40 to 200 samples per path would
 * otherwise trip the p75 rules by chance (a heavy-tailed CLS p75 on 40 samples
 * moves by tens of percent between two days of identical traffic).
 */
const STRESS_PLAN: SeedPlan = {
  label: "stress seed",
  profile: "stress",
  sessionCount: 2_000,
  randomSeed: 20261008,
  trafficEndsBeforeNowMs: 2 * DETECTION_RULES.windowMs,
  incidentFixtures: null,
};

/**
 * SQLite binds at most 32766 parameters per statement and a metric event binds
 * six, so 100k rows cannot travel in one INSERT. 500 rows per statement stays
 * far below the limit while keeping the statement count small.
 */
const INSERT_CHUNK_ROWS = 500;
const PROGRESS_EVERY_EVENTS = 20_000;

/** Anything that can run a statement: the database, or the transaction handle it opens. */
type SeedHandle = Pick<Db, "insert" | "select">;

const chunk = <T>(rows: ReadonlyArray<T>, size: number): T[][] =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));

const mergeTraffic = (parts: ReadonlyArray<SyntheticTraffic>): SyntheticTraffic => ({
  sessions: parts.flatMap((part) => part.sessions),
  pageviews: parts.flatMap((part) => part.pageviews),
  metricEvents: parts.flatMap((part) => part.metricEvents),
});

/**
 * Sites are upserted rather than conflict-ignored so a database seeded before
 * write keys existed gains them on the next run; only the key is touched, so a
 * renamed site keeps its name.
 */
const insertSites = ({ tx, now }: { tx: SeedHandle; now: number }): void => {
  tx.insert(sites)
    .values([
      { ...DEMO_SITE, createdAt: now, writeKey: DEMO_WRITE_KEY },
      { ...DASHBOARD_SITE, createdAt: now, writeKey: DASHBOARD_WRITE_KEY },
    ])
    .onConflictDoUpdate({ target: sites.id, set: { writeKey: sql`excluded.write_key` } })
    .run();
};

const insertTraffic = ({
  tx,
  traffic,
  onEventsInserted,
}: {
  tx: SeedHandle;
  traffic: SyntheticTraffic;
  onEventsInserted: (insertedSoFar: number) => void;
}): void => {
  for (const rows of chunk(traffic.sessions, INSERT_CHUNK_ROWS)) {
    tx.insert(sessions).values(rows).onConflictDoNothing().run();
  }
  for (const rows of chunk(traffic.pageviews, INSERT_CHUNK_ROWS)) {
    tx.insert(pageviews).values(rows).onConflictDoNothing().run();
  }
  let insertedEvents = 0;
  for (const rows of chunk(traffic.metricEvents, INSERT_CHUNK_ROWS)) {
    tx.insert(metricEvents).values(rows).onConflictDoNothing().run();
    insertedEvents += rows.length;
    onEventsInserted(insertedEvents);
  }
};

/**
 * Check observations are stamped relative to `now`, so the dedupe index on
 * (site, check, observed_at) cannot recognise a re-run an hour later. The
 * fixture is therefore planted only into a site with no check history at all;
 * once any application has pushed real checks, the seed leaves them alone.
 */
const insertCheckFixture = ({ tx, siteId, now, seed }: { tx: SeedHandle; siteId: string; now: number; seed: number }): number => {
  const existing = tx.select({ n: count() }).from(checks).where(eq(checks.siteId, siteId)).get()?.n ?? 0;
  if (existing > 0) {
    return 0;
  }
  const observations = generateCheckObservations({ siteId, now, seed });
  tx.insert(checks).values(observations).run();
  return observations.length;
};

const runSeed = ({ db, now, plan }: { db: Db; now: number; plan: SeedPlan }): void => {
  const startedAt = performance.now();
  const elapsedSeconds = (): string => ((performance.now() - startedAt) / 1000).toFixed(1);
  const traffic = generateSyntheticTraffic({
    siteId: DEMO_SITE.id,
    sessionCount: plan.sessionCount,
    now: now - plan.trafficEndsBeforeNowMs,
    seed: plan.randomSeed,
    profile: plan.profile,
  });
  const regression =
    plan.incidentFixtures === null
      ? null
      : generateVitalsRegression({
          siteId: DEMO_SITE.id,
          now,
          seed: plan.incidentFixtures.regression,
          windowMs: DETECTION_RULES.windowMs,
        });
  const allTraffic = regression === null ? traffic : mergeTraffic([traffic, regression]);
  const totalEvents = allTraffic.metricEvents.length;
  let nextProgressAt = PROGRESS_EVERY_EVENTS;
  let checkRowsInserted = 0;

  db.transaction((tx) => {
    insertSites({ tx, now });
    insertTraffic({
      tx,
      traffic: allTraffic,
      onEventsInserted: (insertedSoFar) => {
        if (insertedSoFar < nextProgressAt) {
          return;
        }
        console.log(`${plan.label}: ${insertedSoFar} / ${totalEvents} metric events (${elapsedSeconds()}s)`);
        nextProgressAt += PROGRESS_EVERY_EVENTS;
      },
    });
    if (plan.incidentFixtures !== null) {
      checkRowsInserted = insertCheckFixture({ tx, siteId: DEMO_SITE.id, now, seed: plan.incidentFixtures.checks });
    }
  });

  console.log(
    `${plan.label}: ${allTraffic.sessions.length} sessions, ${allTraffic.pageviews.length} pageviews, ` +
      `${totalEvents} metric events generated in ${elapsedSeconds()}s; rows that already existed were left untouched`,
  );
  if (regression !== null) {
    console.log(
      `${plan.label}: incident fixtures: ${regression.sessions.length} sessions on the regressed path ` +
        `(${regression.metricEvents.length} metric events), ${checkRowsInserted} check observations inserted`,
    );
  }
};

export const seed = (db: Db, now: number = Date.now()): void => runSeed({ db, now, plan: DEMO_PLAN });

/** The M8 benchmark data set: ~2,000 sessions and ~100k metric events over 30 days, under `stress-` ids. */
export const seedStress = (db: Db, now: number = Date.now()): void => runSeed({ db, now, plan: STRESS_PLAN });

/** The planted regression's incident: the one the seeded proposed fix belongs to. */
const SEEDED_FIX_INCIDENT = { source: "web-vitals", subject: "/pricing", metric: "LCP" } as const;

/**
 * Gives the demo's /pricing LCP incident its agent-authored revision 1 (the
 * timeout fix for src/demo/slow-upstream.ts), so the review editor has a real
 * change to show before the M15 agent writes revisions. It cannot live in
 * seed(): seeding runs before detection, and the incident does not exist until
 * the detector opens it. So the two callers that run detection on the demo
 * data (scripts/detect-incidents.ts and the demo-mode cold start in
 * src/db/index.ts) call this right after; the detector itself stays free of
 * demo knowledge. Idempotent: does nothing when the incident is missing, no
 * longer takes fixes, or already has a revision. Returns whether it wrote one.
 */
export const attachSeededFix = ({ db, now = Date.now() }: { db: Db; now?: number }): boolean => {
  const incident = db
    .select({ id: incidents.id })
    .from(incidents)
    .where(
      and(
        eq(incidents.siteId, DEMO_SITE.id),
        eq(incidents.source, SEEDED_FIX_INCIDENT.source),
        eq(incidents.subject, SEEDED_FIX_INCIDENT.subject),
        eq(incidents.metric, SEEDED_FIX_INCIDENT.metric),
        inArray(
          incidents.status,
          ACTIVE_INCIDENT_STATUSES.filter((status) => status !== "approved"),
        ),
      ),
    )
    .get();
  if (incident === undefined || getLatestFixRevision({ db, incidentId: incident.id }) !== undefined) {
    return false;
  }
  const result = submitFixRevision({
    db,
    input: {
      incidentId: incident.id,
      targetRepo: SEEDED_FIX.targetRepo,
      baseSha: SEEDED_FIX.baseSha,
      summary: SEEDED_FIX.summary,
      files: SEEDED_FIX_FILES,
    },
    now,
  });
  return result.ok;
};
