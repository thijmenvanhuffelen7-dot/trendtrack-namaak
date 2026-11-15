import type pg from "pg";

/** Een andere worker is al met dit domein bezig. De job faalt en pg-boss probeert later opnieuw. */
export class DomainBusyError extends Error {
  constructor(readonly key: string) {
    super(`Bezig in een andere worker: ${key}`);
    this.name = "DomainBusyError";
  }
}

/**
 * Max één job tegelijk per domein, ook over meerdere worker-processen/servers heen:
 * Postgres advisory lock op hashtextextended(key). De lock hoort bij de verbinding, dus we
 * houden één client vast tot de job klaar is.
 */
export async function withDomainLock<T>(
  pool: pg.Pool,
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>(
      "select pg_try_advisory_lock(hashtextextended($1, 0)) as ok",
      [`domain:${key}`],
    );
    if (!rows[0]?.ok) throw new DomainBusyError(key);
    try {
      return await fn();
    } finally {
      await client.query("select pg_advisory_unlock(hashtextextended($1, 0))", [`domain:${key}`]);
    }
  } finally {
    client.release();
  }
}
