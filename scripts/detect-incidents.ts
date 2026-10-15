// CLI entry for `npm run incidents:detect`: opens the configured database
// (honouring VITALS_DB_PATH) and runs incident detection for every site, or
// for one with `-- --site <id>`. Prints one line of counts; re-running is safe
// because detection reconciles rather than appends.
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sites } from "@/db/schema";
import { detectIncidents, detectIncidentsForAllSites } from "@/incidents/detect";

const readSiteArgument = (argv: readonly string[]): string | null => {
  const flagIndex = argv.indexOf("--site");
  if (flagIndex === -1) {
    return null;
  }
  const siteId = argv[flagIndex + 1];
  if (siteId === undefined || siteId.startsWith("--")) {
    console.error("usage: npm run incidents:detect [-- --site <id>]");
    process.exit(1);
  }
  return siteId;
};

const siteId = readSiteArgument(process.argv);
const db = getDb();

if (siteId !== null && db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).get() === undefined) {
  console.error(`detect: no site with id "${siteId}"`);
  process.exit(1);
}

const result = siteId === null ? detectIncidentsForAllSites({ db }) : detectIncidents({ db, siteId });
console.log(`detect: opened ${result.opened}, resolved ${result.resolved}, unchanged ${result.unchanged}`);
