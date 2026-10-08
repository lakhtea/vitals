// Prints how many SQL statements each dashboard operation costs against the
// seeded demo site. This is the committed method behind the README's
// "queries" column. Run with: npm run measure:queries
import { graphql } from "graphql";
import { makeDb } from "@/db";
import { createQueryCounter } from "@/db/query-counter";
import { seed } from "@/db/seed";
import type { Context } from "@/graphql/context";
import { schema } from "@/graphql/schema";

const OPERATIONS: ReadonlyArray<{ label: string; source: string }> = [
  {
    label: "site { pages { metrics } }",
    source: `{ site(id: "demo") { pages { path metrics { name p75 } } } }`,
  },
  {
    label: "site { metrics }",
    source: `{ site(id: "demo") { metrics { name p75 } } }`,
  },
];

const main = async (): Promise<void> => {
  const counter = createQueryCounter();
  const db = makeDb(":memory:", { logger: counter.logger });
  seed(db);
  const contextValue: Context = { db };

  for (const operation of OPERATIONS) {
    counter.reset();
    const result = await graphql({ schema, source: operation.source, contextValue });
    if (result.errors) {
      throw new Error(`${operation.label} failed: ${result.errors.map((e) => e.message).join("; ")}`);
    }
    const pageCount = (result.data?.site as { pages?: unknown[] } | undefined)?.pages?.length;
    const suffix = pageCount === undefined ? "" : ` (pages: ${pageCount})`;
    console.log(`${operation.label.padEnd(32)} ${String(counter.count()).padStart(3)} SQL statements${suffix}`);
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
