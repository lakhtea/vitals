import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig's "@/*" -> "src/*" so tests resolve the same imports the app does.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Force a single graphql instance: some deps load the CJS build while
      // Vite-transformed test files get the .mjs build, and graphql-js refuses
      // to execute a schema constructed in another module realm.
      graphql: require.resolve("graphql"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/graphql/**", "src/db/**", "src/vitals/**", "src/collect/**"],
      exclude: ["src/graphql/generated/**"],
    },
  },
});
