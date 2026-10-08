// The single Pothos builder every type definition imports, so plugin
// configuration and the Context type live in exactly one place.
import SchemaBuilder from "@pothos/core";
import DataloaderPlugin from "@pothos/plugin-dataloader";
import type { Context } from "./context";

// The dataloader plugin is installed but unused until M4, where the N+1 ->
// DataLoader arc is built and measured deliberately (see PLAN.md).
export const builder = new SchemaBuilder<{ Context: Context }>({
  plugins: [DataloaderPlugin],
});

builder.queryType({});
