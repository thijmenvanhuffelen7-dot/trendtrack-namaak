import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseMailgunInbound,
  parsePostmarkInbound,
  verifyBasicAuth,
  verifyMailgunSignature,
} from "./email-inbound";

describe("Postmark inbound", () => {
  it("normaliseert de payload en pakt de echte Message-ID", () => {
    const e = parsePostmarkInbound({
      From: '"Zilverzand" <hallo@zilverzand.nl>',
      FromFull: { Email: "Hallo@Zilverzand.nl" },
      To: "zilverzand-k3m9x2@inbox.voorbeeld.nl",
      OriginalRecipient: "zilverzand-k3m9x2@inbox.voorbeeld.nl",
      Subject: "Welkom!",
      HtmlBody: "<p>Hoi</p>",
      TextBody: "Hoi",
      MessageID: "postmark-intern-id",
      Date: "Sat, 15 Nov 2026 10:00:00 +0100",
      Headers: [{ Name: "Message-ID", Value: "<abc@klaviyo.com>" }],
    });
    expect(e).toEqual({
      to: ["zilverzand-k3m9x2@inbox.voorbeeld.nl"],
      from: "hallo@zilverzand.nl",
      subject: "Welkom!",
      html: "<p>Hoi</p>",
      text: "Hoi",
      messageId: "<abc@klaviyo.com>",
      receivedAt: "2026-11-15T09:00:00.000Z",
    });
  });
});

describe("Mailgun inbound", () => {
  const key = "mg-signing-key";
  const now = 1_763_200_000_000;
  const timestamp = String(Math.floor(now / 1000));
  const token = "tok123";
  const signature = createHmac("sha256", key)
    .update(timestamp + token)
    .digest("hex");

  it("verifieert de handtekening", () => {
    expect(verifyMailgunSignature({ timestamp, token, signature }, key, now)).toBe(true);
    expect(verifyMailgunSignature({ timestamp, token, signature: "x".repeat(64) }, key, now)).toBe(
      false,
    );
    expect(verifyMailgunSignature({ timestamp, token, signature }, "andere-key", now)).toBe(false);
    expect(verifyMailgunSignature({ timestamp, token, signature }, key, now + 20 * 60_000)).toBe(
      false,
    );
  });

  it("parseert de velden", () => {
    const e = parseMailgunInbound({
      recipient: "A@inbox.x.nl",
      from: "Shop <s@shop.nl>",
      subject: "Hi",
      "body-html": "<b>x</b>",
      timestamp,
      token,
      signature,
    });
    expect(e).toMatchObject({ to: ["a@inbox.x.nl"], from: "s@shop.nl", html: "<b>x</b>" });
  });
});

describe("verifyBasicAuth", () => {
  const header = (pw: string) => `Basic ${Buffer.from(`postmark:${pw}`).toString("base64")}`;
  it("accepteert alleen het juiste wachtwoord", () => {
    expect(verifyBasicAuth(header("geheim"), "geheim")).toBe(true);
    expect(verifyBasicAuth(header("fout"), "geheim")).toBe(false);
    expect(verifyBasicAuth(null, "geheim")).toBe(false);
    expect(verifyBasicAuth(header(""), "")).toBe(false);
  });
});
