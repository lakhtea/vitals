import SchemaBuilder from "@pothos/core";
import DataloaderPlugin from "@pothos/plugin-dataloader";
import type { Context } from "./context";

/**
 * Pothos schema builder — code-first, strongly typed against Context.
 * The dataloader plugin is installed but intentionally unused so far:
 * the N+1 → DataLoader arc is a planned lesson-paired session (see README).
 */
export const builder = new SchemaBuilder<{ Context: Context }>({
  plugins: [DataloaderPlugin],
});

builder.queryType({});
builder.mutationType({});
