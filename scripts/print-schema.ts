// Writes the GraphQL schema Pothos builds at runtime to schema.graphql, sorted
// so diffs are stable. The committed file is the reviewable contract; codegen
// reads it, and a test fails if the code and the snapshot ever disagree.
import { writeFileSync } from "node:fs";
import { lexicographicSortSchema, printSchema } from "graphql";
import { schema } from "@/graphql/schema";

export const SCHEMA_SNAPSHOT_PATH = "schema.graphql";

export const printSchemaSnapshot = (): string => `${printSchema(lexicographicSortSchema(schema))}\n`;

if (process.argv[1]?.endsWith("print-schema.ts")) {
  writeFileSync(SCHEMA_SNAPSHOT_PATH, printSchemaSnapshot());
  console.log(`wrote ${SCHEMA_SNAPSHOT_PATH}`);
}
