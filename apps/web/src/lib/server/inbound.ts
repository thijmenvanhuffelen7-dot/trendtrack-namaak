import "server-only";
import {
  parseMailgunInbound,
  parsePostmarkInbound,
  verifyBasicAuth,
  verifyMailgunSignature,
  type InboundEmail,
} from "@trendtrack/core";
import { createServiceClient, ingestInboundEmail, readEmailEnv } from "@trendtrack/db";

export type InboundProvider = "postmark" | "mailgun";

export class InboundAuthError extends Error {}

/** Leest en verifieert een inbound-webhook. Gooit InboundAuthError als de afzender niet klopt. */
export async function readInbound(provider: InboundProvider, req: Request): Promise<InboundEmail> {
  if (provider === "postmark") {
    if (
      !verifyBasicAuth(req.headers.get("authorization"), process.env.INBOUND_WEBHOOK_SECRET ?? "")
    ) {
      throw new InboundAuthError("ongeldige basic auth");
    }
    return parsePostmarkInbound(await req.json());
  }
  const form = await req.formData();
  const fields: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") fields[k] = v;
  });
  if (!verifyMailgunSignature(fields, process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? "")) {
    throw new InboundAuthError("ongeldige Mailgun-handtekening");
  }
  return parseMailgunInbound(fields);
}

export async function handleInbound(provider: InboundProvider, req: Request) {
  const email = await readInbound(provider, req);
  const { EMAIL_INBOX_DOMAIN } = readEmailEnv();
  return ingestInboundEmail(createServiceClient(), email, EMAIL_INBOX_DOMAIN);
}
