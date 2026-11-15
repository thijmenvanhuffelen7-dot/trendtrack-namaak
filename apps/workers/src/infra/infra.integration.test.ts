import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkFailures } from "../monitor/failure-alert";
import { DomainBusyError, withDomainLock } from "./domain-lock";
import { tracked } from "./job-runs";

// DATABASE_URL wordt door de globalSetup op de lokale Supabase gezet.
const url = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):54322\//.test(url))
  throw new Error(`Weiger te draaien tegen ${url || "(leeg)"}: alleen lokaal`);
const pool = new pg.Pool({ connectionString: url });
const NAME = "test.integration";

describe("worker-infra tegen Postgres", () => {
  beforeAll(async () => {
    await pool.query("delete from public.job_runs where job_name = $1", [NAME]);
    await pool.query("delete from public.system_alerts where key = 'job_failure_rate'");
  });
  afterAll(async () => {
    await pool.query("delete from public.job_runs where job_name = $1", [NAME]);
    await pool.query("delete from public.system_alerts where key = 'job_failure_rate'");
    await pool.end();
  });

  it("staat maar één job per domein tegelijk toe", async () => {
    let release!: () => void;
    const first = withDomainLock(
      pool,
      "lock-test.nl",
      () => new Promise<string>((r) => (release = () => r("klaar"))),
    );
    await new Promise((r) => setTimeout(r, 50));
    await expect(withDomainLock(pool, "lock-test.nl", async () => "tweede")).rejects.toBeInstanceOf(
      DomainBusyError,
    );
    expect(await withDomainLock(pool, "ander-domein.nl", async () => "mag")).toBe("mag");
    release();
    expect(await first).toBe("klaar");
    expect(await withDomainLock(pool, "lock-test.nl", async () => "nu wel")).toBe("nu wel");
  });

  it("legt geslaagde en mislukte runs vast in job_runs", async () => {
    const ok = tracked(
      pool,
      () => "a.nl",
      async () => ({ n: 1 }),
    );
    const bad = tracked(
      pool,
      () => "b.nl",
      async () => {
        throw new Error("kapot");
      },
    );
    await ok([{ id: crypto.randomUUID(), name: NAME, data: {} }]);
    await expect(bad([{ id: crypto.randomUUID(), name: NAME, data: {} }])).rejects.toThrow("kapot");
    const { rows } = await pool.query(
      "select job_key, status, error, result, duration_ms from public.job_runs where job_name = $1 order by id",
      [NAME],
    );
    expect(rows).toMatchObject([
      { job_key: "a.nl", status: "succeeded", error: null, result: { n: 1 } },
      { job_key: "b.nl", status: "failed", error: "Error: kapot" },
    ]);
    expect(rows[0].duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("meldt bij meer dan 20% fouten in een uur, en daarna niet opnieuw binnen de cooldown", async () => {
    await pool.query("delete from public.job_runs where started_at > now() - interval '1 hour'");
    const bad = tracked(
      pool,
      () => null,
      async () => {
        throw new Error("MetaTokenError: expired");
      },
    );
    const ok = tracked(
      pool,
      () => null,
      async () => "ok",
    );
    for (let i = 0; i < 7; i++) await ok([{ id: crypto.randomUUID(), name: NAME, data: {} }]);
    for (let i = 0; i < 3; i++)
      await bad([{ id: crypto.randomUUID(), name: NAME, data: {} }]).catch(() => undefined);

    const sent: string[] = [];
    const notify = async (p: { text: string }) => {
      sent.push(p.text);
    };
    const first = await checkFailures(pool, notify);
    expect(first.alerted).toBe(true);
    expect(sent[0]).toContain("30%");
    expect(sent[0]).toContain("MetaTokenError");
    const second = await checkFailures(pool, notify);
    expect(second).toMatchObject({ alerted: false, cooldown: true });
    expect(sent).toHaveLength(1);
  });
});
