import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.E2E_BASE_URL?.trim().replace(/\/+$/, "");
const localWebPort = process.env.E2E_WEB_PORT?.trim() || "31817";
const localBaseUrl = `http://localhost:${localWebPort}`;

export default defineConfig({
  testDir: "./tools/browser-e2e/specs",
  outputDir: "test-results/browser-e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  reporter: process.env.CI
    ? [
        ["line"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
      ]
    : "line",
  use: {
    baseURL: externalBaseUrl || localBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "node tools/browser-e2e/start-test-portal.mjs",
        url: `${localBaseUrl}/sign-in`,
        reuseExistingServer: false,
        timeout: 180_000,
      },
  projects: [
    {
      name: "chromium",
      // Use the developer machine's managed Chrome installation. This keeps
      // the acceptance suite runnable after npm/Playwright caches are cleared
      // and avoids a separate multi-hundred-megabyte browser download. CI uses
      // the exact Playwright Chromium revision installed by the workflow.
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.CI ? {} : { channel: "chrome" as const }),
      },
    },
  ],
});
