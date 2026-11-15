import { simpleParser } from "mailparser";
import { describe, expect, it } from "vitest";
import { toInboundEmail } from "./imap-poller";

const RAW = [
  "Delivered-To: zilverzand-k3m9x2@inbox.voorbeeld.nl",
  "From: Zilverzand <Hallo@Zilverzand.nl>",
  "To: catchall@inbox.voorbeeld.nl",
  "Subject: =?UTF-8?Q?Welkom_=F0=9F=91=8B?=",
  "Message-ID: <abc123@klaviyo.com>",
  "Date: Sat, 15 Nov 2026 10:00:00 +0100",
  "MIME-Version: 1.0",
  'Content-Type: multipart/alternative; boundary="b1"',
  "",
  "--b1",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Hoi!",
  "--b1",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>Hoi!</p>",
  "--b1--",
  "",
].join("\r\n");

describe("toInboundEmail", () => {
  it("leest het seed-adres uit Delivered-To en decodeert het onderwerp", async () => {
    const e = toInboundEmail(await simpleParser(RAW));
    expect(e.to).toContain("zilverzand-k3m9x2@inbox.voorbeeld.nl");
    expect(e).toMatchObject({
      from: "hallo@zilverzand.nl",
      subject: "Welkom 👋",
      messageId: "<abc123@klaviyo.com>",
      receivedAt: "2026-11-15T09:00:00.000Z",
      text: "Hoi!",
    });
    expect(e.html).toContain("<p>Hoi!</p>");
  });
});
