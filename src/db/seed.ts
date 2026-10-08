// Idempotent demo seed: one site plus deterministic synthetic traffic, inserted
// with ON CONFLICT DO NOTHING so re-running never duplicates rows and real
// ingested data can coexist with it. `npm run db:seed` runs seed(); `npm run
// db:seed:stress` runs seedStress(), the ~100k-event benchmark data set that
// lives beside it. The CLI entry is scripts/seed-db.ts.
import type { Db } from "./index";
import { metricEvents, pageviews, sessions, sites } from "./schema";
import { generateSyntheticTraffic, type SyntheticTraffic, type TrafficProfileName } from "./synthetic/traffic";

export const DEMO_SITE = { id: "demo", name: "Demo site (synthetic traffic)" } as const;
/** Where the dashboard reports on itself once the browser library (M3) is wired in. */
export const DASHBOARD_SITE = { id: "vitals-dashboard", name: "Vitals dashboard (self-measured)" } as const;

interface SeedPlan {
  label: string;
  profile: TrafficProfileName;
  sessionCount: number;
  randomSeed: number;
}

const DEMO_PLAN: SeedPlan = { label: "seed", profile: "demo", sessionCount: 50, randomSeed: 20261007 };
/** Its own random stream, so the stress set is not the demo set with a longer tail. */
const STRESS_PLAN: SeedPlan = { label: "stress seed", profile: "stress", sessionCount: 2_000, randomSeed: 20261008 };

/**
 * SQLite binds at most 32766 parameters per statement and a metric event binds
 * six, so 100k rows cannot travel in one INSERT. 500 rows per statement stays
 * far below the limit while keeping the statement count small.
 */
const INSERT_CHUNK_ROWS = 500;
const PROGRESS_EVERY_EVENTS = 20_000;

/** Anything that can run an insert: the database, or the transaction handle it opens. */
type Inserter = Pick<Db, "insert">;

const chunk = <T>(rows: ReadonlyArray<T>, size: number): T[][] =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));

const insertSites = ({ tx, now }: { tx: Inserter; now: number }): void => {
  tx.insert(sites)
    .values([
      { ...DEMO_SITE, createdAt: now },
      { ...DASHBOARD_SITE, createdAt: now },
    ])
    .onConflictDoNothing()
    .run();
};

const insertTraffic = ({
  tx,
  traffic,
  onEventsInserted,
}: {
  tx: Inserter;
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

const runSeed = ({ db, now, plan }: { db: Db; now: number; plan: SeedPlan }): void => {
  const startedAt = performance.now();
  const elapsedSeconds = (): string => ((performance.now() - startedAt) / 1000).toFixed(1);
  const traffic = generateSyntheticTraffic({
    siteId: DEMO_SITE.id,
    sessionCount: plan.sessionCount,
    now,
    seed: plan.randomSeed,
    profile: plan.profile,
  });
  const totalEvents = traffic.metricEvents.length;
  let nextProgressAt = PROGRESS_EVERY_EVENTS;

  db.transaction((tx) => {
    insertSites({ tx, now });
    insertTraffic({
      tx,
      traffic,
      onEventsInserted: (insertedSoFar) => {
        if (insertedSoFar < nextProgressAt) {
          return;
        }
        console.log(`${plan.label}: ${insertedSoFar} / ${totalEvents} metric events (${elapsedSeconds()}s)`);
        nextProgressAt += PROGRESS_EVERY_EVENTS;
      },
    });
  });

  console.log(
    `${plan.label}: ${traffic.sessions.length} sessions, ${traffic.pageviews.length} pageviews, ` +
      `${totalEvents} metric events generated in ${elapsedSeconds()}s; rows that already existed were left untouched`,
  );
};

export const seed = (db: Db, now: number = Date.now()): void => runSeed({ db, now, plan: DEMO_PLAN });

/** The M8 benchmark data set: ~2,000 sessions and ~100k metric events over 30 days, under `stress-` ids. */
export const seedStress = (db: Db, now: number = Date.now()): void => runSeed({ db, now, plan: STRESS_PLAN });
