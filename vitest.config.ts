import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    // Force a single graphql instance: some deps load the CJS build while
    // Vite-transformed test files get the .mjs build, and graphql-js refuses
    // to execute a schema constructed in another module realm.
    alias: { graphql: require.resolve("graphql") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/graphql/**", "src/db/**"],
    },
  },
});
