// GraphQL Codegen: turns every graphql(`...`) document into a TypedDocumentNode,
// so useQuery and the MCP tools infer result and variable types from the
// committed schema snapshot. Run with: npm run codegen
import type { CodegenConfig } from "@graphql-codegen/cli";

// The client preset emits one module that maps every document it was given, and
// whoever imports graphql() bundles that whole map. So the dashboard and the MCP
// server each get their own output: the browser never ships the agents' operations.
const clientPreset = {
  preset: "client",
  // Fragment masking adds a useFragment indirection this small app does
  // not need yet; plain result types read better in a teaching codebase.
  presetConfig: { fragmentMasking: false },
  // DateTime travels as an ISO 8601 string (see src/graphql/scalars.ts).
  config: { scalars: { DateTime: "string" } },
} as const;

const config: CodegenConfig = {
  schema: "./schema.graphql",
  generates: {
    "./src/graphql/generated/": {
      ...clientPreset,
      documents: ["src/**/*.tsx", "src/**/*.ts", "!src/graphql/generated/**", "!src/**/*.test.ts"],
    },
    // The agents' side of the same contract, typed from the same schema.
    "./services/vitals-mcp/generated/": {
      ...clientPreset,
      documents: ["services/vitals-mcp/**/*.ts", "!services/vitals-mcp/generated/**", "!services/**/*.test.ts"],
    },
  },
  ignoreNoDocuments: true,
};

export default config;
