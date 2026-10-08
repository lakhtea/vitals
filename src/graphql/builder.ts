// The single Pothos builder every type definition imports, so plugin
// configuration, custom scalar types, and the Context type live in one place.
import SchemaBuilder from "@pothos/core";
import DataloaderPlugin from "@pothos/plugin-dataloader";
import type { Context } from "./context";

export const builder = new SchemaBuilder<{
  Context: Context;
  // Pothos v4 makes every field nullable unless told otherwise. A dashboard
  // schema full of `name: String` forces null checks on every client read, so
  // fields are non-null by default here and opt into null explicitly.
  DefaultFieldNullability: false;
  Scalars: {
    /** Epoch milliseconds inside resolvers, ISO 8601 strings on the wire. */
    DateTime: { Input: number; Output: number };
  };
}>({
  plugins: [DataloaderPlugin],
  defaultFieldNullability: false,
});

builder.queryType({});
