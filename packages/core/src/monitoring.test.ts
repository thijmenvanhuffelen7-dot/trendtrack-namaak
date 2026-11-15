import { describe, expect, it, vi } from "vitest";
import { buildEnvelope, parseDsn, reportError } from "./monitoring";

const DSN = "https://abc123@o42.ingest.sentry.io/4507";

describe("monitoring", () => {
  it("leest een DSN", () => {
    expect(parseDsn(DSN)).toMatchObject({
      publicKey: "abc123",
      host: "o42.ingest.sentry.io",
      projectId: "4507",
      pathPrefix: "",
    });
    expect(parseDsn("https://k@glitchtip.example.com/sub/12")).toMatchObject({
      pathPrefix: "/sub",
      projectId: "12",
    });
    expect(parseDsn("geen-dsn")).toBeNull();
    expect(parseDsn("https://host/12")).toBeNull();
  });

  it("bouwt een envelope met de fout", () => {
    const { body, eventId } = buildEnvelope(
      new TypeError("kapot"),
      { service: "workers", tags: { job: "shop.detect" } },
      DSN,
      new Date(0),
    );
    const [header, item, event] = body
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(header).toMatchObject({ event_id: eventId, dsn: DSN });
    expect(item).toEqual({ type: "event" });
    expect(event.exception.values[0]).toEqual({ type: "TypeError", value: "kapot" });
    expect(event.tags).toEqual({ service: "workers", job: "shop.detect" });
  });

  it("stuurt niets zonder DSN en faalt nooit", async () => {
    const f = vi.fn();
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await reportError(new Error("x"), { service: "web" }, {}, f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
    const failing = vi.fn().mockRejectedValue(new Error("netwerk"));
    expect(
      await reportError(new Error("x"), { service: "web" }, { SENTRY_DSN: DSN }, failing),
    ).toBeNull();
    const ok = vi.fn().mockResolvedValue(new Response(null));
    expect(await reportError(new Error("x"), { service: "mcp" }, { SENTRY_DSN: DSN }, ok)).toMatch(
      /^[0-9a-f]{32}$/,
    );
    expect(ok.mock.calls[0]![0]).toBe("https://o42.ingest.sentry.io/api/4507/envelope/");
    err.mockRestore();
  });
});
