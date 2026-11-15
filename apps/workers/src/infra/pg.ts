import pg from "pg";

let pool: pg.Pool | undefined;

/** Gedeelde Postgres-pool (DATABASE_URL) voor job_runs, locks en planning. */
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL ontbreekt (zie .env.example)");
    pool = new pg.Pool({ connectionString, max: Number(process.env.PG_POOL_MAX ?? 20) });
    pool.on("error", (err) => console.error("[pg]", err));
  }
  return pool;
}

export async function closePool() {
  await pool?.end();
  pool = undefined;
}
