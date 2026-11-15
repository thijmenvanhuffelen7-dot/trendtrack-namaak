export interface RunRow {
  job_name: string;
  status: string;
  duration_ms: number | null;
}

export interface JobSummary {
  job_name: string;
  total: number;
  succeeded: number;
  failed: number;
  running: number;
  failureRate: number;
  avgMs: number | null;
}

/** Samenvatting per jobtype; slechtste eerst. */
export function summarizeRuns(rows: RunRow[]): JobSummary[] {
  const map = new Map<string, JobSummary & { durSum: number; durN: number }>();
  for (const r of rows) {
    const s = map.get(r.job_name) ?? {
      job_name: r.job_name,
      total: 0,
      succeeded: 0,
      failed: 0,
      running: 0,
      failureRate: 0,
      avgMs: null,
      durSum: 0,
      durN: 0,
    };
    s.total++;
    if (r.status === "succeeded") s.succeeded++;
    else if (r.status === "failed") s.failed++;
    else s.running++;
    if (r.duration_ms !== null) {
      s.durSum += r.duration_ms;
      s.durN++;
    }
    map.set(r.job_name, s);
  }
  return [...map.values()]
    .map(({ durSum, durN, ...s }) => ({
      ...s,
      failureRate: s.total - s.running > 0 ? s.failed / (s.total - s.running) : 0,
      avgMs: durN ? Math.round(durSum / durN) : null,
    }))
    .sort((a, b) => b.failureRate - a.failureRate || a.job_name.localeCompare(b.job_name));
}
