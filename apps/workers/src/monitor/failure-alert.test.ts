import { describe, expect, it } from "vitest";
import { alertMessage, shouldAlert, webhookNotifier } from "./failure-alert";

describe("alerting", () => {
  it("meldt pas boven 20% en vanaf 10 jobs", () => {
    expect(shouldAlert({ total: 100, failed: 20, topErrors: [] })).toBe(false);
    expect(shouldAlert({ total: 100, failed: 21, topErrors: [] })).toBe(true);
    expect(shouldAlert({ total: 5, failed: 5, topErrors: [] })).toBe(false);
  });

  it("maakt een leesbare melding", () => {
    const text = alertMessage({
      total: 40,
      failed: 12,
      topErrors: [{ job_name: "ads.discover", error: "MetaTokenError: expired", count: 9 }],
    });
    expect(text).toContain("30%");
    expect(text).toContain("ads.discover (9×)");
  });

  it("POST naar de webhook", async () => {
    const calls: { url: string; body: string }[] = [];
    const notify = webhookNotifier("https://n8n.example/webhook/x", (async (
      url: string,
      init: RequestInit,
    ) => {
      calls.push({ url, body: String(init.body) });
      return new Response("ok");
    }) as typeof fetch);
    await notify({ text: "hoi", stats: { total: 10, failed: 5, topErrors: [] } });
    expect(calls[0]?.url).toBe("https://n8n.example/webhook/x");
    expect(JSON.parse(calls[0]!.body)).toMatchObject({ source: "trendtrack-workers", text: "hoi" });
  });
});
