// Idempotent demo seed: one site plus deterministic synthetic traffic, inserted
// with ON CONFLICT DO NOTHING so re-running never duplicates rows and real
// ingested data can coexist with it. Run with: npm run db:seed
import { getDb, type Db } from "./index";
import { metricEvents, pageviews, sessions, sites } from "./schema";
import { generateSyntheticTraffic } from "./synthetic/traffic";

export const DEMO_SITE = { id: "demo", name: "Demo site (synthetic traffic)" } as const;

const SESSION_COUNT = 50;
const RANDOM_SEED = 20261007;

export const seed = (db: Db, now: number = Date.now()): void => {
  const traffic = generateSyntheticTraffic({
    siteId: DEMO_SITE.id,
    sessionCount: SESSION_COUNT,
    now,
    seed: RANDOM_SEED,
  });

  db.transaction((tx) => {
    tx.insert(sites).values({ ...DEMO_SITE, createdAt: now }).onConflictDoNothing().run();
    tx.insert(sessions).values(traffic.sessions).onConflictDoNothing().run();
    tx.insert(pageviews).values(traffic.pageviews).onConflictDoNothing().run();
    tx.insert(metricEvents).values(traffic.metricEvents).onConflictDoNothing().run();
  });

  console.log(
    `seed: ${traffic.sessions.length} sessions, ${traffic.pageviews.length} pageviews, ` +
      `${traffic.metricEvents.length} metric events generated; rows that already existed were left untouched`,
  );
};

// Allow `tsx src/db/seed.ts` direct execution.
if (process.argv[1]?.endsWith("seed.ts")) {
  seed(getDb());
}
