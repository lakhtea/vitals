import { defineConfig, devices } from "@playwright/test";

/**
 * One E2E path (per the production bar): home page renders seeded applications
 * fetched through the real GraphQL endpoint.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // Escape hatch for sandboxes/CI images that ship a preinstalled Chromium
    // instead of running `npx playwright install`.
    ...(process.env.PW_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
      : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run db:seed && npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: { PIPELINE_DB_PATH: ".data/e2e.db" },
    timeout: 120_000,
  },
});
