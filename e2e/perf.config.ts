import { defineConfig } from "@playwright/test";

// Rendering performance budgets (#311). Run with: npx playwright test -c perf.config.ts
export default defineConfig({
  testDir: "./perf",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["json", { outputFile: "perf-results/report.json" }]] : "list",
  use: { baseURL: "http://127.0.0.1:4180", viewport: { width: 1440, height: 900 } },
  webServer: {
    command: "node ./scripts/perfstack.mjs",
    cwd: __dirname,
    url: "http://127.0.0.1:4180",
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
});
