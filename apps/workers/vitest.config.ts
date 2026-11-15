import { defineProject } from "vitest/config";
export default defineProject({
  test: {
    name: "workers",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
  },
});
