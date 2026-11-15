import { serviceDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * Uptime-check: 200 als de database bereikbaar is, anders 503. Meldt ook of de workers
 * het laatste uur nog jobs draaiden (alleen een vlag, geen details).
 */
export async function GET() {
  const db = serviceDb();
  const started = Date.now();
  const { error } = await db.from("plans").select("id").limit(1);
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = error
    ? { count: null }
    : await db
        .from("job_runs")
        .select("id", { count: "exact", head: true })
        .gte("started_at", since);
  return Response.json(
    {
      ok: !error,
      db: error ? "down" : "up",
      workersActiveLastHour: (count ?? 0) > 0,
      ms: Date.now() - started,
    },
    { status: error ? 503 : 200, headers: { "cache-control": "no-store" } },
  );
}
