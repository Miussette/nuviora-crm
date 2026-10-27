import { defineConfig, devices } from "@playwright/test";
import { config } from "./apps/api/node_modules/dotenv";
config({ path: ".env", quiet: true });
const webPort = Number(process.env.E2E_WEB_PORT ?? 3100);
const apiPort = Number(process.env.E2E_API_PORT ?? 3101);
const origin = `http://localhost:${webPort}`;
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  use: { baseURL: origin, trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
      },
    },
  ],
  webServer: [
    {
      command:
        "pnpm --filter @nuviora/domain build && pnpm --filter @nuviora/api build && node apps/api/dist/main.js",
      url: `http://127.0.0.1:${apiPort}/api/v1/health`,
      env: { PORT: String(apiPort), APP_ORIGIN: origin },
      reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
      timeout: 120000,
    },
    {
      command: `pnpm --filter @nuviora/web exec next dev --port ${webPort}`,
      url: `${origin}/login`,
      env: {
        API_INTERNAL_ORIGIN: `http://127.0.0.1:${apiPort}`,
        NEXT_DIST_DIR: ".next-e2e",
      },
      reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
      timeout: 120000,
    },
  ],
});
