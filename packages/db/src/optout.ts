import { normalizeDomain } from "@trendtrack/core";
import type { Db } from "./client";

export const OPTOUT_MESSAGE = "Deze shop is op verzoek van de eigenaar verwijderd.";

export async function isOptedOut(serviceDb: Db, domain: string): Promise<boolean> {
  const { data, error } = await serviceDb.rpc("is_opted_out", { p_domain: domain });
  if (error) throw error;
  return data === true;
}

/**
 * Nieuw opt-out-verzoek. Eén open verzoek per domein: een tweede keer geeft het bestaande terug.
 * Een admin controleert (bv. of het e-mailadres bij het domein hoort) en keurt goed of af.
 */
export async function createOptoutRequest(
  serviceDb: Db,
  input: { domain: string; email: string; reason?: string | null },
) {
  const domain = normalizeDomain(input.domain);
  const { data: open } = await serviceDb
    .from("optout_requests")
    .select("id, status")
    .eq("domain", domain)
    .eq("status", "pending")
    .maybeSingle();
  if (open) return { id: open.id, domain, existing: true };
  const { data, error } = await serviceDb
    .from("optout_requests")
    .insert({ domain, email: input.email, reason: input.reason ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, domain, existing: false };
}

export async function listOptoutRequests(serviceDb: Db) {
  const { data, error } = await serviceDb
    .from("optout_requests")
    .select("id, domain, email, reason, status, admin_note, decided_at, created_at")
    .order("status", { ascending: false }) // pending eerst (p > a, r)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

/** Goedkeuren: domein op de lijst en alle shopgegevens weg. Geeft het aantal verwijderde shops terug. */
export async function approveOptout(
  serviceDb: Db,
  requestId: string,
  adminId: string,
  note?: string,
) {
  const { data, error } = await serviceDb.rpc("approve_optout", {
    p_request: requestId,
    p_admin: adminId,
    p_note: note ?? undefined,
  });
  if (error) throw error;
  return data;
}

export async function rejectOptout(
  serviceDb: Db,
  requestId: string,
  adminId: string,
  note?: string,
) {
  const { error } = await serviceDb
    .from("optout_requests")
    .update({
      status: "rejected",
      decided_by: adminId,
      decided_at: new Date().toISOString(),
      admin_note: note ?? null,
    })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw error;
}
