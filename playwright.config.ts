import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5180",
    trace: "retain-on-failure"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ],
  webServer: {
    command: "npx vite --port 5180 --strictPort",
    url: "http://localhost:5180",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
