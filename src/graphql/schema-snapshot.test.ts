// Fails when src/graphql changes shape without schema.graphql being
// regenerated, so the committed snapshot (and everything generated from it)
// can never silently drift from the schema the server actually serves.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { printSchemaSnapshot, SCHEMA_SNAPSHOT_PATH } from "../../scripts/print-schema";

describe("schema.graphql snapshot", () => {
  it("matches the schema Pothos builds (run `npm run codegen` to update it)", () => {
    const committed = readFileSync(SCHEMA_SNAPSHOT_PATH, "utf8");
    expect(committed).toBe(printSchemaSnapshot());
  });
});
