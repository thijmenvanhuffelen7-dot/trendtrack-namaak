import { describe, expect, it } from "vitest";
import { APP_SIGNATURES, detectApps } from "./app-signatures";

describe("APP_SIGNATURES", () => {
  it("heeft minstens 50 apps met unieke ids", () => {
    expect(APP_SIGNATURES.length).toBeGreaterThanOrEqual(50);
    const ids = APP_SIGNATURES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("detecteert apps aan de hand van scriptbronnen", () => {
    const html = `<script src="https://cdn.rebuyengine.com/x.js"></script><script src="//loox.io/widget.js"></script>`;
    expect(detectApps(html)).toEqual(["loox", "rebuy"]);
  });
});
