import {
  buildResult,
  isMetered,
  limitFor,
  METERED,
  periodBounds,
  PLANS,
  resolvePlan,
  type PlanId,
  type SubscriptionLike,
  type UsageAction,
  type UsageResult,
} from "@trendtrack/core";
import type { Db } from "./client";

export interface WorkspacePlan {
  plan: PlanId;
  subscription:
    | (SubscriptionLike & {
        id: string;
        billing_interval: string | null;
        cancel_at_period_end: boolean;
        provider_customer_id: string | null;
      })
    | null;
  trialEndsAt: string | null;
  seats: number;
}

/** Het plan dat nu geldt voor een workspace (zie resolvePlan). Aanroepen met de service client. */
export async function getWorkspacePlan(
  serviceDb: Db,
  workspaceId: string,
  now = new Date(),
): Promise<WorkspacePlan> {
  const { data, error } = await serviceDb
    .from("subscriptions")
    .select(
      "id, plan_id, status, provider, trial_ends_at, current_period_end, seats, billing_interval, cancel_at_period_end, provider_customer_id",
    )
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  const subs = data.map((d) => ({ ...d, provider: d.provider as SubscriptionLike["provider"] }));
  const { plan, subscription } = resolvePlan(subs, now);
  const sub = subscription as WorkspacePlan["subscription"];
  return {
    plan,
    subscription: sub,
    trialEndsAt: sub?.provider === "manual" ? sub.trial_ends_at : null,
    seats: Math.max(PLANS[plan].limits.seats, sub?.seats ?? 1),
  };
}

export interface UsageOptions {
  userId?: string | null;
  source?: "web" | "api" | "mcp" | "system";
  quantity?: number;
  /** Zelfde sleutel binnen de periode telt één keer (bv. het domein bij shop_lookup). */
  key?: string;
  now?: Date;
  /** false = alleen controleren, niets vastleggen. */
  record?: boolean;
}

/**
 * Controleert de limiet voor een actie en legt het gebruik vast als het past.
 * Dé centrale functie voor limieten: web, REST API en MCP gebruiken alleen deze.
 *
 * - Periodieke acties (shop_lookup, ad_search, api_call) tellen usage_events in de huidige
 *   periode, atomair via de SQL-functie record_usage.
 * - folder en tracked_brand tellen bestaande rijen; record doet daar niets (de rij zelf telt).
 */
export async function checkAndRecordUsage(
  serviceDb: Db,
  workspaceId: string,
  action: UsageAction,
  opts: UsageOptions = {},
): Promise<UsageResult> {
  const now = opts.now ?? new Date();
  const { plan } = await getWorkspacePlan(serviceDb, workspaceId, now);
  const limit = limitFor(plan, action);

  if (isMetered(action)) {
    const { start, end } = periodBounds(METERED[action].period, now);
    const { data, error } = await serviceDb.rpc("record_usage", {
      p_workspace: workspaceId,
      // De SQL-functie accepteert null (geen gebruiker / onbeperkt); de gegenereerde types weten dat niet.
      p_user: (opts.userId ?? null) as string,
      p_action: action,
      p_source: opts.source ?? "web",
      p_since: start.toISOString(),
      p_limit: limit as number,
      p_quantity: opts.quantity ?? 1,
      p_key: opts.key ?? undefined,
      p_record: opts.record ?? true,
    });
    if (error) throw error;
    const row = data[0]!;
    return buildResult({
      action,
      plan,
      limit,
      used: row.used,
      allowed: row.allowed,
      resetsAt: end.toISOString(),
    });
  }

  const table = action === "folder" ? "folders" : "tracked_brands";
  const { count, error } = await serviceDb
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  const used = count ?? 0;
  // "allowed" betekent overal: er kan er nog één (of `quantity`) bij, ook bij alleen controleren.
  const adding = opts.quantity ?? 1;
  return buildResult({
    action,
    plan,
    limit,
    used,
    allowed: limit === null || used + adding <= limit,
    resetsAt: null,
  });
}

/** Overzicht voor de billing-pagina: alle limieten met het huidige gebruik (zonder iets vast te leggen). */
export async function getUsageSummary(serviceDb: Db, workspaceId: string, now = new Date()) {
  const actions: UsageAction[] = [
    "shop_lookup",
    "ad_search",
    "folder",
    "tracked_brand",
    "api_call",
  ];
  const results = await Promise.all(
    actions.map((a) => checkAndRecordUsage(serviceDb, workspaceId, a, { now, record: false })),
  );
  const { count: members } = await serviceDb
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  return { usage: results, members: members ?? 1 };
}

/** Vroegste e-maildatum die dit plan mag zien, of null voor alles. */
export function emailHistoryFloor(plan: PlanId, now = new Date()): string | null {
  const days = PLANS[plan].limits.emailHistoryDays;
  return days === null
    ? null
    : new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}
