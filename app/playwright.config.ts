import { defineConfig, devices } from "@playwright/test";

const baseUrl = process.env.TEST_URL || "http://localhost:28623";
const startCommand = process.env.TEST_START_COMMAND || "bun run dev";

export default defineConfig({
   testDir: "./e2e",
   fullyParallel: true,
   forbidOnly: !!process.env.CI,
   retries: process.env.CI ? 2 : 0,
   workers: process.env.CI ? 1 : undefined,
   reporter: "html",
   use: {
      baseURL: baseUrl,
      trace: "on-first-retry",
      video: "on-first-retry",
   },
   projects: [
      {
         name: "chromium",
         use: { ...devices["Desktop Chrome"] },
      },
      /* {
         name: "firefox",
         use: { ...devices["Desktop Firefox"] },
      },
      {
         name: "webkit",
         use: { ...devices["Desktop Safari"] },
      }, */
   ],
   webServer: {
      command: startCommand,
      url: baseUrl,
      reuseExistingServer: !process.env.CI,
   },
});
