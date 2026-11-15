import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests tegen de lokale Supabase (`pnpm db:start`). Draai met `pnpm test:db`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    name: "web-integration",
    include: ["src/**/*.integration.test.ts"],
    globalSetup: ["../../packages/db/test/supabase-env.ts"],
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
