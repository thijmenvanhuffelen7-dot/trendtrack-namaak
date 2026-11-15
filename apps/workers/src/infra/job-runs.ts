import { reportError } from "@trendtrack/core";
import type pg from "pg";

/** Verwachte fouten (shop blokkeert, netwerk, domein bezet): retry, geen melding naar monitoring. */
const EXPECTED = new Set([
  "BlockedError",
  "RobotsDisallowedError",
  "UnreachableError",
  "UnsafeTargetError",
  "DomainBusyError",
]);

export interface JobLike {
  id: string;
  name: string;
  data: unknown;
}

/**
 * Wikkelt een handler zodat elke run in `job_runs` komt (status, duur, fout, resultaat).
 * Fouten worden opnieuw gegooid zodat pg-boss zijn retry-logica toepast.
 */
export function tracked<J extends JobLike, R>(
  pool: pg.Pool,
  keyOf: (job: J) => string | null,
  handler: (job: J) => Promise<R>,
): (jobs: J[]) => Promise<R> {
  return async ([job]) => {
    if (!job) throw new Error("lege batch");
    const started = Date.now();
    const key = keyOf(job);
    const { rows } = await pool.query<{ id: string }>(
      "insert into public.job_runs (job_id, job_name, job_key, status) values ($1, $2, $3, 'running') returning id",
      [job.id, job.name, key],
    );
    const runId = rows[0]?.id;
    try {
      const result = await handler(job);
      await pool.query(
        "update public.job_runs set status = 'succeeded', finished_at = now(), duration_ms = $2, result = $3 where id = $1",
        [runId, Date.now() - started, JSON.stringify(result ?? null)],
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      await pool.query(
        "update public.job_runs set status = 'failed', finished_at = now(), duration_ms = $2, error = $3 where id = $1",
        [runId, Date.now() - started, message.slice(0, 2000)],
      );
      if (!(err instanceof Error && EXPECTED.has(err.name)))
        void reportError(err, { service: "workers", tags: { job: job.name }, extra: { key } });
      throw err;
    }
  };
}
