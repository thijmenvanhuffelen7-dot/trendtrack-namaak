import { escapeLike, type EmailFilters } from "@trendtrack/core";
import type { Db } from "../client";
import { EMAIL_BUCKET } from "../email-ingest";

const EMAIL_COLUMNS =
  "id, shop_id, from_address, subject, preheader, received_at, type, flow_step, text_preview, html_storage_path, shops!inner(domain, name, niche)";

export async function listEmails(db: Db, f: EmailFilters) {
  let q = db.from("emails").select(EMAIL_COLUMNS, { count: "exact" });
  if (f.type) q = q.eq("type", f.type);
  if (f.domain) q = q.eq("shops.domain", f.domain.toLowerCase());
  if (f.niche) q = q.eq("shops.niche", f.niche);
  if (f.since) q = q.gte("received_at", f.since);
  if (f.until) q = q.lte("received_at", `${f.until}T23:59:59Z`);
  if (f.q) {
    const term = escapeLike(f.q);
    if (term) q = q.or(`subject.ilike.%${term}%,preheader.ilike.%${term}%`);
  }
  const from = (f.page - 1) * f.per_page;
  const { data, count, error } = await q
    .order("received_at", { ascending: false })
    .range(from, from + f.per_page - 1);
  if (error) throw error;
  return { rows: data, total: count ?? 0, page: f.page, perPage: f.per_page };
}
export type EmailRow = Awaited<ReturnType<typeof listEmails>>["rows"][number];

export async function getEmail(db: Db, id: string): Promise<EmailRow | null> {
  const { data, error } = await db.from("emails").select(EMAIL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEmailsByIds(db: Db, ids: string[]): Promise<EmailRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from("emails").select(EMAIL_COLUMNS).in("id", ids);
  if (error) throw error;
  return data;
}

/** De opgeschoonde HTML uit Storage. Toon dit ALLEEN in een sandboxed iframe. */
export async function getEmailHtml(db: Db, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await db.storage.from(EMAIL_BUCKET).download(path);
  if (error) return null;
  return data.text();
}
