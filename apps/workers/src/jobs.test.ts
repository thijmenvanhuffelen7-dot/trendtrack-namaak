import { describe, expect, it } from "vitest";
import { JOBS } from "./jobs";

describe("JOBS", () => {
  it("heeft unieke namen", () => {
    const names = Object.values(JOBS);
    expect(new Set(names).size).toBe(names.length);
  });
});
