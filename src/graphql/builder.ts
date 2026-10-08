// The single Pothos builder every type definition imports, so plugin
// configuration, custom scalar types, and the Context type live in one place.
import SchemaBuilder from "@pothos/core";
import DataloaderPlugin from "@pothos/plugin-dataloader";
import type { Context } from "./context";

export const builder = new SchemaBuilder<{
  Context: Context;
  Scalars: {
    /** Epoch milliseconds inside resolvers, ISO 8601 strings on the wire. */
    DateTime: { Input: number; Output: number };
  };
}>({
  plugins: [DataloaderPlugin],
});

builder.queryType({});
