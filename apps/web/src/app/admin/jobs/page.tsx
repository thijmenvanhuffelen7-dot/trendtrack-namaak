import { serviceDb } from "@/lib/server/db";
import { summarizeRuns } from "@/lib/server/job-stats";

export const dynamic = "force-dynamic";

const fmtMs = (ms: number | null) =>
  ms === null ? "–" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    dateStyle: "short",
    timeStyle: "medium",
  });

export default async function JobsPage() {
  const db = serviceDb();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const [runs, recent, failures, queues] = await Promise.all([
    db
      .from("job_runs")
      .select("job_name, status, duration_ms")
      .gte("started_at", since)
      .limit(20_000),
    db
      .from("job_runs")
      .select("id, job_name, job_key, status, started_at, duration_ms")
      .order("id", { ascending: false })
      .limit(50),
    db
      .from("job_runs")
      .select("id, job_name, job_key, started_at, error")
      .eq("status", "failed")
      .order("id", { ascending: false })
      .limit(20),
    db.rpc("admin_queue_stats"),
  ]);
  const summary = summarizeRuns(runs.data ?? []);
  const lastHour = (runs.data ?? []).length;

  return (
    <div className="space-y-8">
      <meta httpEquiv="refresh" content="30" />
      <header>
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Laatste 24 uur · {lastHour} runs · ververst elke 30 s
        </p>
      </header>

      <section>
        <h2 className="mb-2 font-medium">Per jobtype (24 uur)</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1">Job</th>
              <th>Totaal</th>
              <th>Gelukt</th>
              <th>Mislukt</th>
              <th>Bezig</th>
              <th>Foutpercentage</th>
              <th>Gem. duur</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.job_name} className="border-t border-border">
                <td className="py-1 font-mono">{s.job_name}</td>
                <td>{s.total}</td>
                <td>{s.succeeded}</td>
                <td className={s.failed ? "text-red-600" : ""}>{s.failed}</td>
                <td>{s.running}</td>
                <td className={s.failureRate > 0.2 ? "font-semibold text-red-600" : ""}>
                  {Math.round(s.failureRate * 100)}%
                </td>
                <td>{fmtMs(s.avgMs)}</td>
              </tr>
            ))}
            {summary.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-muted-foreground">
                  Nog geen runs. Draaien de workers?
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Wachtrij (pg-boss)</h2>
        {queues.error ? (
          <p className="text-sm text-red-600">Kon de wachtrij niet lezen: {queues.error.message}</p>
        ) : (
          <div className="flex flex-wrap gap-2 text-sm">
            {(queues.data ?? []).map((q) => (
              <span
                key={`${q.name}-${q.state}`}
                className="rounded-md border border-border px-2 py-1 font-mono"
              >
                {q.name} · {q.state}: {q.jobs}
              </span>
            ))}
            {(queues.data ?? []).length === 0 && (
              <span className="text-muted-foreground">Leeg</span>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Recente fouten</h2>
        <ul className="space-y-1 text-sm">
          {(failures.data ?? []).map((f) => (
            <li key={f.id} className="rounded-md border border-border p-2">
              <span className="font-mono">{f.job_name}</span>{" "}
              {f.job_key && <span className="text-muted-foreground">({f.job_key})</span>}{" "}
              <span className="text-muted-foreground">· {fmtTime(f.started_at)}</span>
              <div className="mt-1 break-words font-mono text-xs text-red-600">{f.error}</div>
            </li>
          ))}
          {(failures.data ?? []).length === 0 && (
            <li className="text-muted-foreground">Geen fouten.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Laatste 50 runs</h2>
        <table className="w-full text-sm">
          <tbody>
            {(recent.data ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-1 text-muted-foreground">{fmtTime(r.started_at)}</td>
                <td className="font-mono">{r.job_name}</td>
                <td className="text-muted-foreground">{r.job_key}</td>
                <td
                  className={
                    r.status === "failed"
                      ? "text-red-600"
                      : r.status === "running"
                        ? "text-amber-600"
                        : ""
                  }
                >
                  {r.status}
                </td>
                <td>{fmtMs(r.duration_ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
