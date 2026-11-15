import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/workers", "apps/mcp", "apps/web"],
  },
});
