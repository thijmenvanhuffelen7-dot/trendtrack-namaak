import { describe, expect, it } from "vitest";
import { summarizeRuns } from "./job-stats";

describe("summarizeRuns", () => {
  it("telt per job en sorteert op foutpercentage", () => {
    const s = summarizeRuns([
      { job_name: "a", status: "succeeded", duration_ms: 100 },
      { job_name: "a", status: "failed", duration_ms: 300 },
      { job_name: "b", status: "succeeded", duration_ms: 10 },
      { job_name: "b", status: "running", duration_ms: null },
    ]);
    expect(s[0]).toEqual({
      job_name: "a",
      total: 2,
      succeeded: 1,
      failed: 1,
      running: 0,
      failureRate: 0.5,
      avgMs: 200,
    });
    expect(s[1]).toMatchObject({ job_name: "b", running: 1, failureRate: 0, avgMs: 10 });
  });
});
