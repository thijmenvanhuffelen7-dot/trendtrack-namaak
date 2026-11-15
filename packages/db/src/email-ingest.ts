import { randomUUID } from "node:crypto";
import {
  classifyEmails,
  extractPreheader,
  generateSeedAddress,
  normalizeDomain,
  sanitizeEmailHtml,
  toPlainText,
  type EmailType,
  type InboundEmail,
} from "@trendtrack/core";
import type { Db } from "./client";

export const EMAIL_BUCKET = "emails";

export type IngestStatus = "stored" | "duplicate" | "unknown_recipient";

export interface IngestEmailResult {
  status: IngestStatus;
  emailId?: string;
  shopId?: string;
  type?: EmailType;
  flowStep?: number | null;
}

/**
 * Verwerkt één binnenkomende mail: koppelen aan de shop via het seed-adres, HTML opschonen
 * en opslaan in Storage, rij in `emails`, en de mails van die shop opnieuw classificeren.
 * Gebruikt door de inbound-webhook (web) en de IMAP-poller (workers).
 */
export async function ingestInboundEmail(
  db: Db,
  email: InboundEmail,
  inboxDomain: string,
): Promise<IngestEmailResult> {
  const suffix = `@${inboxDomain.toLowerCase()}`;
  const candidates = email.to.filter((a) => a.endsWith(suffix));

  const { data: inbox, error: inboxError } = candidates.length
    ? await db
        .from("seed_inboxes")
        .select("id, shop_id, address, subscribed_at")
        .in("address", candidates)
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  if (inboxError) throw inboxError;
  if (!inbox) {
    await db.from("inbound_rejects").insert({
      to_addresses: email.to,
      from_address: email.from,
      subject: email.subject,
      reason: candidates.length ? "onbekend seed-adres" : "geen adres op het inbox-domein",
    });
    return { status: "unknown_recipient" };
  }

  if (email.messageId) {
    const { data: dupe } = await db
      .from("emails")
      .select("id, type, flow_step")
      .eq("shop_id", inbox.shop_id)
      .eq("message_id", email.messageId)
      .maybeSingle();
    if (dupe)
      return {
        status: "duplicate",
        emailId: dupe.id,
        shopId: inbox.shop_id,
        type: dupe.type,
        flowStep: dupe.flow_step,
      };
  }

  const id = randomUUID();
  const rawHtml = email.html ?? `<pre>${escapeHtml(email.text ?? "")}</pre>`;
  const clean = sanitizeEmailHtml(rawHtml, { seedAddress: inbox.address });
  const path = `${inbox.shop_id}/${id}.html`;
  const { error: uploadError } = await db.storage
    .from(EMAIL_BUCKET)
    .upload(path, new Blob([clean], { type: "text/html; charset=utf-8" }), {
      contentType: "text/html; charset=utf-8",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const preview = toPlainText(clean).replaceAll(inbox.address, "").slice(0, 500);
  const { error: insertError } = await db.from("emails").insert({
    id,
    shop_id: inbox.shop_id,
    seed_inbox_id: inbox.id,
    from_address: email.from,
    to_address: inbox.address,
    subject: email.subject,
    preheader: extractPreheader(clean),
    html_storage_path: path,
    received_at: email.receivedAt,
    message_id: email.messageId,
    text_preview: preview || null,
    type: "campaign",
  });
  if (insertError) throw insertError;

  const classified = await reclassifyShopEmails(db, inbox.shop_id, inbox.id, inbox.subscribed_at);
  const mine = classified.find((c) => c.id === id);
  return {
    status: "stored",
    emailId: id,
    shopId: inbox.shop_id,
    type: mine?.type ?? "campaign",
    flowStep: mine?.flowStep ?? null,
  };
}

/** Classificeert alle mails van een seed-inbox opnieuw en werkt alleen gewijzigde rijen bij. */
export async function reclassifyShopEmails(
  db: Db,
  shopId: string,
  seedInboxId: string,
  subscribedAt: string | null,
) {
  const { data, error } = await db
    .from("emails")
    .select("id, received_at, type, flow_step")
    .eq("shop_id", shopId)
    .eq("seed_inbox_id", seedInboxId);
  if (error) throw error;
  const result = classifyEmails(
    data.map((e) => ({ id: e.id, receivedAt: e.received_at })),
    subscribedAt,
  );
  const current = new Map(data.map((e) => [e.id, e]));
  for (const c of result) {
    const before = current.get(c.id);
    if (before && before.type === c.type && before.flow_step === c.flowStep) continue;
    const { error: e } = await db
      .from("emails")
      .update({ type: c.type, flow_step: c.flowStep })
      .eq("id", c.id);
    if (e) throw e;
  }
  return result;
}

// --- Seed-inboxen beheren (CLI/admin) ----------------------------------------

export async function getOrCreateSeedInbox(db: Db, shopDomain: string, inboxDomain: string) {
  const domain = normalizeDomain(shopDomain);
  const { data: shop, error } = await db
    .from("shops")
    .select("id, name, domain")
    .eq("domain", domain)
    .maybeSingle();
  if (error) throw error;
  if (!shop) throw new Error(`Shop ${domain} bestaat niet; crawl hem eerst`);

  const { data: existing } = await db
    .from("seed_inboxes")
    .select("*")
    .eq("shop_id", shop.id)
    .maybeSingle();
  if (existing) return { ...existing, created: false };

  const { data, error: e } = await db
    .from("seed_inboxes")
    .insert({
      shop_id: shop.id,
      address: generateSeedAddress(shop.name ?? shop.domain, inboxDomain),
    })
    .select("*")
    .single();
  if (e) throw e;
  return { ...data, created: true };
}

/** Leg vast wanneer je je hebt ingeschreven; herclassificeert bestaande mails. */
export async function markSubscribed(db: Db, shopDomain: string, at: Date) {
  const domain = normalizeDomain(shopDomain);
  const { data: shop } = await db.from("shops").select("id").eq("domain", domain).single();
  if (!shop) throw new Error(`Shop ${domain} bestaat niet`);
  const { data, error } = await db
    .from("seed_inboxes")
    .update({ subscribed_at: at.toISOString() })
    .eq("shop_id", shop.id)
    .select("*")
    .single();
  if (error) throw new Error(`Geen seed-inbox voor ${domain}; maak die eerst aan`);
  await reclassifyShopEmails(db, shop.id, data.id, data.subscribed_at);
  return data;
}

export async function listSeedInboxes(db: Db) {
  const { data, error } = await db
    .from("seed_inboxes")
    .select("address, subscribed_at, created_at, shops!inner(domain, name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
