import { createHash, randomBytes } from "node:crypto";
import { MAX_API_KEYS } from "@trendtrack/core";
import type { Db } from "./client";

const PREFIX = "tt_live_";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Nieuwe key: tt_live_ + 32 tekens base62 (~190 bits). */
export function generateApiKey(): string {
  const bytes = randomBytes(48);
  let out = "";
  for (const b of bytes) {
    if (b < 248) out += ALPHABET[b % 62]; // 248 = 4 × 62: geen voorkeur voor bepaalde tekens
    if (out.length === 32) break;
  }
  if (out.length < 32) return generateApiKey();
  return PREFIX + out;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function looksLikeApiKey(key: string): boolean {
  return /^tt_live_[A-Za-z0-9]{32}$/.test(key);
}

/** Maakt een key en geeft hem één keer terug. In de database staat alleen de hash. */
export async function createApiKey(
  serviceDb: Db,
  workspaceId: string,
  userId: string,
  name: string,
) {
  const { count } = await serviceDb
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_API_KEYS)
    throw new Error(`Maximaal ${MAX_API_KEYS} actieve API-keys per workspace`);
  const key = generateApiKey();
  const { data, error } = await serviceDb
    .from("api_keys")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      name: name.trim().slice(0, 60) || "API-key",
      prefix: key.slice(0, 12),
      key_hash: hashApiKey(key),
    })
    .select("id, name, prefix, created_at")
    .single();
  if (error) throw error;
  return { ...data, key };
}

export async function listApiKeys(db: Db, workspaceId: string) {
  const { data, error } = await db
    .from("api_keys")
    .select("id, name, prefix, created_at, last_used_at, revoked_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function revokeApiKey(serviceDb: Db, workspaceId: string, keyId: string) {
  const { error } = await serviceDb
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("workspace_id", workspaceId)
    .is("revoked_at", null);
  if (error) throw error;
}

/** Controleert een key. Null als hij niet bestaat of is ingetrokken. */
export async function verifyApiKey(
  serviceDb: Db,
  key: string,
): Promise<{ keyId: string; workspaceId: string } | null> {
  if (!looksLikeApiKey(key)) return null;
  const { data, error } = await serviceDb
    .from("api_keys")
    .select("id, workspace_id, revoked_at, last_used_at")
    .eq("key_hash", hashApiKey(key))
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at) return null;
  // last_used_at hooguit eens per minuut bijwerken (scheelt schrijfacties).
  if (!data.last_used_at || Date.now() - Date.parse(data.last_used_at) > 60_000) {
    await serviceDb
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
  }
  return { keyId: data.id, workspaceId: data.workspace_id };
}

export interface RateResult {
  allowed: boolean;
  limitedBy: "second" | "day" | null;
  secondCount: number;
  dayCount: number;
  dayReset: string;
}

export async function hitApiRateLimit(
  serviceDb: Db,
  keyId: string,
  perSecond: number,
  perDay: number,
): Promise<RateResult> {
  const { data, error } = await serviceDb.rpc("api_rate_hit", {
    p_key: keyId,
    p_per_second: perSecond,
    p_per_day: perDay,
  });
  if (error) throw error;
  const r = data[0]!;
  return {
    allowed: r.allowed,
    limitedBy: (r.limited_by as "second" | "day" | null) ?? null,
    secondCount: r.second_count,
    dayCount: r.day_count,
    dayReset: r.day_reset,
  };
}
