import { describe, expect, it } from "vitest";
import { normalizeDomain, tryNormalizeDomain } from "./domain";

describe("normalizeDomain", () => {
  it.each([
    ["shop.nl", "shop.nl"],
    ["https://www.Shop.nl/products/x?y=1", "shop.nl"],
    ["http://WWW.voorbeeld.be", "voorbeeld.be"],
    ["  merk.myshopify.com/ ", "merk.myshopify.com"],
    ["sub.domein.co.uk.", "sub.domein.co.uk"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each(["", "localhost", "192.168.1.1", "http://[::1]", "geen spaties.nl", "-a.nl"])(
    "weigert %s",
    (input) => {
      expect(() => normalizeDomain(input)).toThrow();
    },
  );
});

describe("tryNormalizeDomain", () => {
  it("geeft null bij ongeldige invoer", () => {
    expect(tryNormalizeDomain("localhost")).toBeNull();
    expect(tryNormalizeDomain(undefined)).toBeNull();
    expect(tryNormalizeDomain("www.x.nl")).toBe("x.nl");
  });
});
