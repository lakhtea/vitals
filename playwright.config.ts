// E2E harness: boots a freshly seeded app on its own database file so browser
// tests never depend on, or disturb, local dev data.
import { defineConfig, devices } from "@playwright/test";

const E2E_DB_PATH = ".data/e2e.db";
// Delete the previous run's database (and SQLite's WAL sidecars) so the seed
// always produces the same, current data set.
const resetE2eDb = `node -e "for (const f of ['${E2E_DB_PATH}','${E2E_DB_PATH}-wal','${E2E_DB_PATH}-shm']) require('node:fs').rmSync(f, { force: true })"`;

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
    command: `${resetE2eDb} && npm run db:seed && npm run dev`,
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: { VITALS_DB_PATH: E2E_DB_PATH },
    timeout: 120_000,
  },
});
