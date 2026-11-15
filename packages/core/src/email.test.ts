import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractAddresses, generateSeedAddress } from "./email-address";
import { classifyEmails } from "./email-classify";
import { extractPreheader, sanitizeEmailHtml } from "./email-sanitize";

const html = readFileSync(new URL("./__fixtures__/klaviyo-welcome.html", import.meta.url), "utf8");
const SEED = "zilverzand-k3m9x2@inbox.voorbeeld.nl";

describe("sanitizeEmailHtml", () => {
  const clean = sanitizeEmailHtml(html, { seedAddress: SEED });

  it("haalt scripts, iframes, forms, event-handlers, javascript: en meta refresh weg", () => {
    expect(clean).not.toMatch(
      /<script|<iframe|<form|<input|onload|onclick|javascript:|http-equiv|refresh/i,
    );
    expect(clean).not.toContain("evil.example");
  });

  it("houdt inhoud, styles en gewone afbeeldingen", () => {
    expect(clean).toContain("WELKOM10");
    expect(clean).toContain("<style>");
    expect(clean).toContain("https://cdn.shopify.com/s/files/hero.jpg");
    expect(clean).toContain('href="https://zilverzand.nl/collections/all?utm_source=klaviyo"');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });

  it("verwijdert tracking-pixels", () => {
    expect(clean).not.toContain("pixel.gif");
    expect(clean).not.toContain("example.com/x.png");
  });

  it("maakt persoonlijke afmeldlinks onklikbaar en haalt het seed-adres weg", () => {
    expect(clean).not.toContain("unsubscribe?a=");
    expect(clean).not.toContain("persoonlijk");
    expect(clean).not.toContain("pages/contact"); // linktekst "Afmelden"
    expect(clean).not.toContain(SEED);
    expect(clean).toContain("jij@voorbeeld.nl");
  });

  it("blokkeert XSS-varianten", () => {
    const evil = `<img src=x onerror=alert(1)><svg onload=alert(1)><a href="JaVaScRiPt:alert(1)">x</a><div style="background:url(javascript:alert(1))">y</div><object data="x.swf"></object>`;
    const out = sanitizeEmailHtml(evil);
    expect(out).not.toMatch(/onerror|onload|<svg|<object|javascript:alert\(1\)">/i);
  });
});

describe("extractPreheader", () => {
  it("pakt de verborgen preheader", () => {
    expect(extractPreheader(html)).toBe("Welkom! Hier is je 10% korting");
  });
  it("valt terug op de eerste tekst", () => {
    expect(
      extractPreheader(
        "<html><head><title>T</title></head><body><p>Nieuwe collectie   online</p></body></html>",
      ),
    ).toBe("Nieuwe collectie online");
  });
});

describe("seed-adressen", () => {
  it("maakt een onraadbaar adres op basis van de shopnaam", () => {
    expect(
      generateSeedAddress("Zilverzand Sieraden & Co", "Inbox.Voorbeeld.nl", () => "k3m9x2"),
    ).toBe("zilverzand-sieraden-co-k3m9x2@inbox.voorbeeld.nl");
    expect(generateSeedAddress("bosbad.be", "inbox.x.nl", () => "abc")).toBe(
      "bosbad-abc@inbox.x.nl",
    );
    const a = generateSeedAddress("x", "inbox.x.nl");
    expect(a).toMatch(/^x-[a-z2-9]{6}@inbox\.x\.nl$/);
  });
  it("haalt adressen uit headers", () => {
    expect(extractAddresses(['"Zilverzand" <Info@Zilverzand.nl>', "a@b.nl, C@D.be"])).toEqual([
      "info@zilverzand.nl",
      "a@b.nl",
      "c@d.be",
    ]);
  });
});

describe("classifyEmails", () => {
  const sub = "2026-11-01T10:00:00Z";
  const at = (iso: string, id = iso) => ({ id, receivedAt: iso });

  it("welcome binnen 48 uur, flow op vaste afstand, campagne de rest", () => {
    const r = classifyEmails(
      [
        at("2026-11-01T10:01:00Z", "w1"), // direct na inschrijven
        at("2026-11-02T10:02:30Z", "w2"), // +24u, nog binnen 48u
        at("2026-11-05T10:03:00Z", "f1"), // +72u na w2: vaste afstand
        at("2026-11-06T17:42:00Z", "c1"), // willekeurig tijdstip
        at("2026-11-08T10:04:00Z", "f2"), // +72u na f1
        at("2026-12-20T09:00:00Z", "c2"), // na 30 dagen
      ],
      sub,
    );
    expect(r.map((e) => [e.id, e.type, e.flowStep])).toEqual([
      ["w1", "welcome", 1],
      ["w2", "welcome", 2],
      ["f1", "flow", 3],
      ["c1", "campaign", null],
      ["f2", "flow", 4],
      ["c2", "campaign", null],
    ]);
  });

  it("zonder inschrijfdatum is alles een campagne", () => {
    expect(classifyEmails([at("2026-11-01T10:00:00Z")], null)[0]?.type).toBe("campaign");
  });

  it("mails van vóór de inschrijving zijn campagnes", () => {
    expect(classifyEmails([at("2026-10-31T10:00:00Z")], sub)[0]?.type).toBe("campaign");
  });
});
