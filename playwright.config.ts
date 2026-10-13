import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const PORT = 3100;
const WIKI_MOCK_PORT = 3199;
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E тестове срещу production сборка с тестовата база.
 * Преди първото пускане: npm run build
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  globalSetup: "./tests/global-setup.ts",
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    {
      command: `npx next start -p ${PORT}`,
      url: `${baseURL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
        APP_URL: baseURL,
        EMAIL_DEV_OUTBOX: "true",
        ANTHROPIC_API_KEY: "",
        SHOW_UNVERIFIED_CONTENT: "true",
        // pipeline за съдържание: записани реални отговори на Уикипедия от локален сървър
        WIKIPEDIA_BG_API_URL: `http://127.0.0.1:${WIKI_MOCK_PORT}/w/api.php`,
        PIPELINE_MIN_INTERVAL_MS: "0",
        PIPELINE_CONTACT_EMAIL: "e2e@example.bg",
      },
    },
    {
      command: "npx tsx tests/e2e/wiki-mock.ts",
      url: `http://127.0.0.1:${WIKI_MOCK_PORT}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { WIKI_MOCK_PORT: String(WIKI_MOCK_PORT) },
    },
  ],
});
