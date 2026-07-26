import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 5174", url: "http://127.0.0.1:5174", reuseExistingServer: false },
  use: { baseURL: "http://127.0.0.1:5174", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } } },
  ],
});
