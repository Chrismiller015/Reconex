import { defineConfig } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- -p 3001",
    url: baseURL,
    // Avoid Next.js dev lock conflicts when a dev server is already running
    // (e.g. via docker/podman compose). If nothing is running, Playwright will
    // still start the server using `command`.
    reuseExistingServer: true,
    env: {
      // Keep local/dev simple: auth is optional in this release.
      SKIP_ENV_VALIDATION: "true",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5433/reconex?schema=public",
      RECONEX_STORAGE_DIR:
        process.env.RECONEX_STORAGE_DIR ?? path.join(process.cwd(), ".playwright", "uploads"),
      RECONEX_MAX_UPLOAD_BYTES: process.env.RECONEX_MAX_UPLOAD_BYTES ?? String(50 * 1024 * 1024),
    },
  },
});

