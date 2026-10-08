// CLI entry for `npm run db:seed` and `npm run db:seed:stress` (--stress):
// opens the configured database (honouring VITALS_DB_PATH) and runs the
// idempotent demo or stress seed. Kept out of src/db/seed.ts so that module
// stays importable by src/db/index.ts without an import cycle.
import { getDb } from "@/db";
import { seed, seedStress } from "@/db/seed";

const run = process.argv.includes("--stress") ? seedStress : seed;

run(getDb());
