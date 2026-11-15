import type pg from "pg";

export interface FailureStats {
  total: number;
  failed: number;
  topErrors: { job_name: string; error: string; count: number }[];
}

export const ALERT = {
  /** Melden boven dit percentage mislukte jobs in het afgelopen uur. */
  failureRate: 0.2,
  /** Pas melden vanaf zoveel jobs; 1 van de 2 mislukt is nog geen storing. */
  minJobs: 10,
  /** Niet vaker dan eens per uur dezelfde melding. */
  cooldownMinutes: 60,
} as const;

export function shouldAlert(stats: FailureStats): boolean {
  return stats.total >= ALERT.minJobs && stats.failed / stats.total > ALERT.failureRate;
}

export function alertMessage(stats: FailureStats): string {
  const pct = Math.round((stats.failed / stats.total) * 100);
  const lines = stats.topErrors.map(
    (e) => `- ${e.job_name} (${e.count}×): ${e.error.slice(0, 160)}`,
  );
  return [
    `TrendTrack workers: ${pct}% van de jobs mislukte in het afgelopen uur (${stats.failed}/${stats.total}).`,
    ...lines,
  ].join("\n");
}

export async function failureStats(pool: pg.Pool): Promise<FailureStats> {
  const { rows } = await pool.query<{ total: string; failed: string }>(
    `select count(*) as total, count(*) filter (where status = 'failed') as failed
       from public.job_runs where started_at > now() - interval '1 hour' and status <> 'running'`,
  );
  const top = await pool.query<{ job_name: string; error: string; count: string }>(
    `select job_name, coalesce(error, '?') as error, count(*) as count from public.job_runs
      where started_at > now() - interval '1 hour' and status = 'failed'
      group by 1, 2 order by 3 desc limit 5`,
  );
  return {
    total: Number(rows[0]?.total ?? 0),
    failed: Number(rows[0]?.failed ?? 0),
    topErrors: top.rows.map((r) => ({ ...r, count: Number(r.count) })),
  };
}

export type Notify = (payload: { text: string; stats: FailureStats }) => Promise<void>;

/** Webhook (bv. n8n): POST JSON { text, stats }. n8n kan dat doorsturen als e-mail/Slack. */
export function webhookNotifier(url: string, fetchImpl: typeof fetch = fetch): Notify {
  return async (payload) => {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "trendtrack-workers", ...payload }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Alert-webhook gaf HTTP ${res.status}`);
  };
}

/** Controleert het foutpercentage en meldt als nodig (met cooldown). */
export async function checkFailures(pool: pg.Pool, notify: Notify | null) {
  const stats = await failureStats(pool);
  if (!shouldAlert(stats)) return { alerted: false, stats };
  const { rows } = await pool.query<{ last_sent_at: Date }>(
    "select last_sent_at from public.system_alerts where key = 'job_failure_rate'",
  );
  const last = rows[0]?.last_sent_at;
  if (last && Date.now() - last.getTime() < ALERT.cooldownMinutes * 60_000)
    return { alerted: false, stats, cooldown: true };

  const text = alertMessage(stats);
  if (notify) await notify({ text, stats });
  else console.error("[alert]", text);
  await pool.query(
    `insert into public.system_alerts (key, last_sent_at, last_payload) values ('job_failure_rate', now(), $1)
     on conflict (key) do update set last_sent_at = excluded.last_sent_at, last_payload = excluded.last_payload`,
    [JSON.stringify(stats)],
  );
  return { alerted: true, stats };
}
