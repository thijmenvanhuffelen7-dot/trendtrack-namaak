import { extractAddresses, type InboundEmail } from "@trendtrack/core";
import { ingestInboundEmail, type Db } from "@trendtrack/db";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { z } from "zod";

const ImapEnvSchema = z.object({
  IMAP_HOST: z.string().min(1),
  IMAP_PORT: z.coerce.number().int().default(993),
  IMAP_USER: z.string().min(1),
  IMAP_PASSWORD: z.string().min(1),
  IMAP_SECURE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  IMAP_POLL_SECONDS: z.coerce.number().int().min(10).default(30),
});

export function readImapEnv(env: NodeJS.ProcessEnv = process.env) {
  return ImapEnvSchema.parse(env);
}

/** Zet een geparste mail om naar ons formaat. Catch-all: het echte adres staat vaak in Delivered-To. */
export function toInboundEmail(mail: ParsedMail, now = new Date()): InboundEmail {
  // mailparser geeft adres-headers soms als object ({ text }), soms als string.
  const header = (name: string): string => {
    const v: unknown = mail.headers.get(name);
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map(String).join(", ");
    if (v && typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
    return "";
  };
  const addrText = (a: ParsedMail["to"]) =>
    Array.isArray(a) ? a.map((x) => x.text).join(", ") : (a?.text ?? "");
  return {
    to: extractAddresses([
      addrText(mail.to),
      addrText(mail.cc),
      header("delivered-to"),
      header("x-original-to"),
    ]),
    from: mail.from?.value[0]?.address?.toLowerCase() ?? "",
    subject: mail.subject ?? null,
    html: typeof mail.html === "string" ? mail.html : null,
    text: mail.text ?? null,
    messageId: mail.messageId ?? null,
    receivedAt: (mail.date ?? now).toISOString(),
  };
}

/** Eén ronde: alle ongelezen mails ophalen, verwerken en als gelezen markeren. */
export async function pollImapOnce(db: Db, inboxDomain: string, env = readImapEnv()) {
  const client = new ImapFlow({
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    secure: env.IMAP_SECURE,
    auth: { user: env.IMAP_USER, pass: env.IMAP_PASSWORD },
    logger: false,
  });
  await client.connect();
  const stats = { processed: 0, stored: 0, unknown: 0, failed: 0 };
  const lock = await client.getMailboxLock("INBOX");
  try {
    const uids = (await client.search({ seen: false }, { uid: true })) || [];
    for (const uid of uids) {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) continue;
      try {
        const result = await ingestInboundEmail(
          db,
          toInboundEmail(await simpleParser(msg.source)),
          inboxDomain,
        );
        stats.processed++;
        if (result.status === "stored") stats.stored++;
        if (result.status === "unknown_recipient") stats.unknown++;
        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      } catch (err) {
        // Niet als gelezen markeren: volgende ronde opnieuw.
        stats.failed++;
        console.error("[imap] mail mislukt", uid, err);
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return stats;
}

/** Blijft pollen tot stop() wordt aangeroepen. */
export function startImapPoller(db: Db, inboxDomain: string) {
  const env = readImapEnv();
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async () => {
    try {
      const s = await pollImapOnce(db, inboxDomain, env);
      if (s.processed) console.log("[imap]", s);
    } catch (err) {
      console.error("[imap] poll mislukt", err);
    }
    if (!stopped) timer = setTimeout(tick, env.IMAP_POLL_SECONDS * 1000);
  };
  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
