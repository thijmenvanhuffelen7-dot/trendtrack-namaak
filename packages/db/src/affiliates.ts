import type { Db } from "./client";

export const AFFILIATE_CODE = /^[a-z0-9_-]{3,40}$/;

/** Affiliate-code van een gebruiker, of null. */
export async function getAffiliate(db: Db, userId: string) {
  const { data, error } = await db
    .from("affiliates")
    .select("code, commission_pct, active, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Maakt een affiliate-code aan (service role). Bestaat de code al bij iemand anders, dan null. */
export async function createAffiliate(serviceDb: Db, userId: string, code: string) {
  const existing = await getAffiliate(serviceDb, userId);
  if (existing) return existing;
  const { data, error } = await serviceDb
    .from("affiliates")
    .insert({ code, user_id: userId })
    .select("code, commission_pct, active, created_at")
    .single();
  if (error?.code === "23505") return null;
  if (error) throw error;
  return data;
}

/**
 * De referral-code uit de cookie, alleen als die bij een actieve affiliate hoort
 * en niet van de koper zelf is (geen commissie op je eigen abonnement).
 */
export async function validReferral(serviceDb: Db, code: string | null, buyerUserId: string) {
  if (!code || !AFFILIATE_CODE.test(code)) return null;
  const { data } = await serviceDb
    .from("affiliates")
    .select("user_id, active")
    .eq("code", code)
    .maybeSingle();
  return data?.active && data.user_id !== buyerUserId ? code : null;
}

export async function affiliateStats(serviceDb: Db, code: string) {
  const { data, error } = await serviceDb.rpc("affiliate_stats", { p_code: code });
  if (error) throw error;
  return { signups: Number(data[0]?.signups ?? 0), paying: Number(data[0]?.paying ?? 0) };
}
