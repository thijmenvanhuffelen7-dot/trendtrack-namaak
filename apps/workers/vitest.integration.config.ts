import { defineConfig } from "vitest/config";

// Tests tegen de lokale Supabase (`pnpm db:start`). Draai met `pnpm test:db`.
export default defineConfig({
  test: {
    name: "workers-integration",
    include: ["src/**/*.integration.test.ts"],
    globalSetup: ["../../packages/db/test/supabase-env.ts"],
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
