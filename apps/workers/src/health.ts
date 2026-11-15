import { createServer, type Server } from "node:http";
import type pg from "pg";

/** GET /health: 200 als de database bereikbaar is, anders 503. Voor Docker en uptime-checks. */
export function startHealthServer(
  pool: pg.Pool,
  port: number,
  info: () => Record<string, unknown>,
): Server {
  const startedAt = new Date();
  const server = createServer(async (req, res) => {
    if (req.url !== "/health") {
      res.writeHead(404).end();
      return;
    }
    let db = false;
    let lastRun: string | null = null;
    try {
      const { rows } = await pool.query<{ last: Date | null }>(
        "select max(started_at) as last from public.job_runs",
      );
      db = true;
      lastRun = rows[0]?.last?.toISOString() ?? null;
    } catch {
      db = false;
    }
    res.writeHead(db ? 200 : 503, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: db,
        db,
        startedAt: startedAt.toISOString(),
        lastJobRunAt: lastRun,
        ...info(),
      }),
    );
  });
  server.listen(port);
  return server;
}
