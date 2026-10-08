// GraphQL Codegen: turns every graphql(`...`) document in the client code into
// a TypedDocumentNode, so useQuery infers result and variable types from the
// committed schema snapshot. Run with: npm run codegen
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "./schema.graphql",
  documents: ["src/**/*.tsx", "src/**/*.ts", "!src/graphql/generated/**", "!src/**/*.test.ts"],
  generates: {
    "./src/graphql/generated/": {
      preset: "client",
      // Fragment masking adds a useFragment indirection this small app does
      // not need yet; plain result types read better in a teaching codebase.
      presetConfig: { fragmentMasking: false },
      // DateTime travels as an ISO 8601 string (see src/graphql/scalars.ts).
      config: { scalars: { DateTime: "string" } },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
