import { defineConfig, devices } from "@playwright/test";

const baseUrl = process.env.TEST_URL || "http://localhost:28623";
const startCommand = process.env.TEST_START_COMMAND || "bun run dev";
const autoStart = ["1", "true", undefined].includes(process.env.TEST_AUTO_START);

export default defineConfig({
   testMatch: "**/*.e2e-spec.ts",
   testDir: "./e2e",
   fullyParallel: true,
   forbidOnly: !!process.env.CI,
   retries: process.env.CI ? 2 : 0,
   workers: process.env.CI ? 1 : undefined,
   reporter: "html",
   timeout: 20000,
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
   webServer: autoStart
      ? {
           command: startCommand,
           url: baseUrl,
           reuseExistingServer: !process.env.CI,
        }
      : undefined,
});
