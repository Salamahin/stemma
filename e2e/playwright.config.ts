import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 20_000
  },
  fullyParallel: true,
  // 4 vCPU runners: on the kernel 7.0 image (ubuntu-24.04 20261018) 4 Chromes
  // starved each other ~3x and timed out the layout tests; 2 run at full speed.
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "node ./scripts/devstack.mjs",
    cwd: __dirname,
    url: "http://127.0.0.1:4173",
    timeout: 300_000,
    reuseExistingServer: !process.env.CI
  }
});
