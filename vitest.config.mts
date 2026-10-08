import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

// Two projects: "unit" runs the Node tests against in-memory SQLite (npm run
// test); "storybook" runs every story's play function and a11y check in real
// Chromium (npm run test:storybook). They are split so the fast unit loop
// never needs a browser.
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
    coverage: {
      provider: "v8",
      include: ["src/graphql/**", "src/db/**", "src/vitals/**", "src/collect/**"],
      exclude: ["src/graphql/generated/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: ".storybook" })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
