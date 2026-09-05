import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./site/tests",
  testMatch: "**/*.spec.mjs",
  fullyParallel: true,
  reporter: "line",
  use: { baseURL: externalBaseURL || "http://127.0.0.1:4173", trace: "retain-on-failure", serviceWorkers: "block" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, userAgent: devices["Pixel 7"].userAgent, isMobile: true, hasTouch: true } }
  ],
  webServer: externalBaseURL ? undefined : { command: "npm run dev", url: "http://127.0.0.1:4173", reuseExistingServer: true }
});
