import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3107);
const dataDir = process.env.PLAYWRIGHT_DATA_DIR
  ?? path.join(os.tmpdir(), "emberdex-playwright-data");

export default defineConfig({
  testDir: ".",
  testMatch: ["**/nuzlocke-flows.pw.spec.ts"],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
  },
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      EMBERDEX_DATA_DIR: dataDir,
    },
  },
});
