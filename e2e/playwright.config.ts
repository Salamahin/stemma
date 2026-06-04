import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 20_000
  },
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry"
  },
  webServer: {
    command: "node ./scripts/devstack.mjs",
    cwd: __dirname,
    url: "http://127.0.0.1:4173",
    timeout: 300_000,
    reuseExistingServer: !process.env.CI
  }
});
