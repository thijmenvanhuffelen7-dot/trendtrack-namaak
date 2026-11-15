import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { extractAddresses } from "./email-address";

/** Genormaliseerde binnenkomende mail, ongeacht de bron (Postmark, Mailgun, IMAP). */
export interface InboundEmail {
  to: string[];
  from: string;
  subject: string | null;
  html: string | null;
  text: string | null;
  messageId: string | null;
  receivedAt: string;
}

// --- Postmark inbound (JSON) -------------------------------------------------
const PostmarkSchema = z.object({
  From: z.string().default(""),
  FromFull: z.object({ Email: z.string() }).partial().optional(),
  To: z.string().optional(),
  ToFull: z.array(z.object({ Email: z.string() }).partial()).optional(),
  Cc: z.string().optional(),
  OriginalRecipient: z.string().optional(),
  Subject: z.string().nullish(),
  HtmlBody: z.string().nullish(),
  TextBody: z.string().nullish(),
  MessageID: z.string().nullish(),
  Date: z.string().nullish(),
  Headers: z.array(z.object({ Name: z.string(), Value: z.string() })).default([]),
});

export function parsePostmarkInbound(body: unknown, now = new Date()): InboundEmail {
  const p = PostmarkSchema.parse(body);
  const header = (name: string) => p.Headers.find((h) => h.Name.toLowerCase() === name)?.Value;
  const to = extractAddresses([
    p.OriginalRecipient ?? "",
    p.To ?? "",
    p.Cc ?? "",
    ...(p.ToFull ?? []).map((t) => t.Email ?? ""),
    header("delivered-to") ?? "",
    header("x-original-to") ?? "",
  ]);
  return {
    to,
    from: p.FromFull?.Email?.toLowerCase() ?? extractAddresses(p.From)[0] ?? "",
    subject: p.Subject ?? null,
    html: p.HtmlBody || null,
    text: p.TextBody || null,
    messageId: header("message-id") ?? p.MessageID ?? null,
    receivedAt: toIso(p.Date, now),
  };
}

// --- Mailgun inbound (form fields) ------------------------------------------
const MailgunSchema = z.object({
  recipient: z.string(),
  sender: z.string().optional(),
  from: z.string().optional(),
  subject: z.string().optional(),
  "body-html": z.string().optional(),
  "body-plain": z.string().optional(),
  "Message-Id": z.string().optional(),
  Date: z.string().optional(),
  timestamp: z.string(),
  token: z.string(),
  signature: z.string(),
});

export function parseMailgunInbound(
  fields: Record<string, string>,
  now = new Date(),
): InboundEmail {
  const m = MailgunSchema.parse(fields);
  return {
    to: extractAddresses(m.recipient),
    from: extractAddresses(m.from ?? m.sender ?? "")[0] ?? "",
    subject: m.subject ?? null,
    html: m["body-html"] || null,
    text: m["body-plain"] || null,
    messageId: m["Message-Id"] ?? null,
    receivedAt: toIso(m.Date, now),
  };
}

/** Mailgun-webhook echt? HMAC-SHA256(timestamp + token) met de signing key, max 15 min oud. */
export function verifyMailgunSignature(
  fields: { timestamp?: string; token?: string; signature?: string },
  signingKey: string,
  now = Date.now(),
): boolean {
  const { timestamp, token, signature } = fields;
  if (!timestamp || !token || !signature || !signingKey) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 15 * 60) return false;
  const expected = createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest("hex");
  return safeEqual(expected, signature);
}

/** Postmark: Basic auth in de webhook-URL; we checken het wachtwoord. */
export function verifyBasicAuth(authorization: string | null, secret: string): boolean {
  if (!authorization?.startsWith("Basic ") || !secret) return false;
  const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const password = decoded.slice(decoded.indexOf(":") + 1);
  return safeEqual(password, secret);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function toIso(date: string | null | undefined, now: Date): string {
  const t = date ? Date.parse(date) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : now.toISOString();
}
