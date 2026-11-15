import { describe, expect, it } from "vitest";
import { readServerEnv } from "./env";

describe("readServerEnv", () => {
  it("accepteert geldige env", () => {
    const env = readServerEnv({
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "x",
    });
    expect(env.SUPABASE_URL).toBe("http://127.0.0.1:54321");
  });
  it("faalt zonder service role key", () => {
    expect(() => readServerEnv({ SUPABASE_URL: "http://127.0.0.1:54321" })).toThrow();
  });
});
