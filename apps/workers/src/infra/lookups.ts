import type pg from "pg";
import type { DetectResult } from "../crawler/detect-shop";
import { enqueueDomains, type JobQueue } from "../crawler/discovery";

/** Na zoveel minuten zonder resultaat geven we een lookup op. */
const STALE_MINUTES = 15;

/**
 * Pakt lookups op die gebruikers via web/API/MCP aanvroegen (tabel `lookup_requests`) en zet
 * ze met voorrang in de wachtrij voor shop.detect. De web-app hoeft zo niets van pg-boss te weten.
 */
export async function dispatchLookups(pool: pg.Pool, queue: JobQueue): Promise<number> {
  const { rows } = await pool.query<{ id: string; domain: string }>(
    `update public.lookup_requests set status = 'processing'
      where id in (select id from public.lookup_requests where status = 'queued' order by created_at limit 25 for update skip locked)
      returning id, domain`,
  );
  if (rows.length) await enqueueDomains(queue, [...new Set(rows.map((r) => r.domain))], "user");
  await pool.query(
    `update public.lookup_requests set status = 'failed', error = 'Geen resultaat binnen ${STALE_MINUTES} minuten'
      where status = 'processing' and updated_at < now() - interval '${STALE_MINUTES} minutes'`,
  );
  return rows.length;
}

/** Werkt openstaande lookups voor dit domein bij met de uitkomst van shop.detect. */
export async function completeLookups(pool: pg.Pool, result: DetectResult): Promise<void> {
  const status =
    result.status !== "active" ? result.status : result.isShopify ? "done" : "not_shopify";
  await pool.query(
    `update public.lookup_requests set status = $2, shop_id = $3, error = null
      where domain = $1 and status in ('queued', 'processing')`,
    [result.domain, status, result.shopId],
  );
}

/** Tussentijdse fout (bv. netwerk): laat zien wat er misging; pg-boss probeert het opnieuw. */
export async function noteLookupError(
  pool: pg.Pool,
  domain: string,
  message: string,
): Promise<void> {
  await pool.query(
    "update public.lookup_requests set error = $2 where domain = $1 and status in ('queued', 'processing')",
    [domain, message.slice(0, 500)],
  );
}

export function startLookupDispatcher(pool: pg.Pool, queue: JobQueue, intervalMs = 3000) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async () => {
    try {
      await dispatchLookups(pool, queue);
    } catch (err) {
      console.error("[lookups]", err);
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
