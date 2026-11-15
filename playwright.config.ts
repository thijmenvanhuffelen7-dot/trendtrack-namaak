import { defineConfig } from "@playwright/test";

/**
 * End-to-end tegen een draaiende stack (lokaal: pnpm db:start, pnpm dev, pnpm mcp).
 * Draaien: pnpm e2e. Tegen staging: E2E_BASE_URL=https://... E2E_MCP_URL=https://.../mcp pnpm e2e
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "off",
    locale: "nl-NL",
    viewport: { width: 1360, height: 900 },
    // Voorgeïnstalleerde Chromium gebruiken als die er is (CI-container), anders de standaard.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
});
