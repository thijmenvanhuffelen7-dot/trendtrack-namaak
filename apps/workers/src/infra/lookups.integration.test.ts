import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { JOBS, PRIORITY } from "../jobs";
import { completeLookups, dispatchLookups } from "./lookups";

const url = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):54322\//.test(url)) throw new Error("alleen lokaal");
const pool = new pg.Pool({ connectionString: url });
const DOMAIN = "lookup-test.nl";

describe("lookups", () => {
  afterAll(async () => {
    await pool.query("delete from public.lookup_requests where domain = $1", [DOMAIN]);
    await pool.query("delete from public.shops where domain = $1", [DOMAIN]);
    await pool.query("delete from auth.users where email = 'lookup@test.local'");
    await pool.end();
  });

  it("zet een aangevraagde lookup met voorrang in de wachtrij en rondt hem af na detect", async () => {
    const { rows: u } = await pool.query(
      "insert into auth.users (id, email, aud, role) values (gen_random_uuid(), 'lookup@test.local', 'authenticated', 'authenticated') returning id",
    );
    const { rows: ws } = await pool.query("select id from public.workspaces where owner_id = $1", [
      u[0].id,
    ]);
    const { rows: lr } = await pool.query(
      "insert into public.lookup_requests (workspace_id, requested_by, domain) values ($1, $2, $3) returning id",
      [ws[0].id, u[0].id, DOMAIN],
    );

    const sent: { name: string; data: object; options?: { priority?: number } }[] = [];
    const queue = {
      send: async (name: string, data: object, options?: { priority?: number }) => (
        sent.push({ name, data, options }),
        "job"
      ),
    };
    expect(await dispatchLookups(pool, queue)).toBe(1);
    expect(sent).toMatchObject([
      { name: JOBS.shopDetect, data: { domain: DOMAIN }, options: { priority: PRIORITY.user } },
    ]);
    expect(await dispatchLookups(pool, queue)).toBe(0); // niet twee keer

    const { rows: shop } = await pool.query(
      "insert into public.shops (domain, platform) values ($1, 'shopify') returning id",
      [DOMAIN],
    );
    await completeLookups(pool, {
      domain: DOMAIN,
      shopId: shop[0].id,
      status: "active",
      isShopify: true,
      info: null,
      linkedAds: 0,
    });
    const { rows } = await pool.query(
      "select status, shop_id from public.lookup_requests where id = $1",
      [lr[0].id],
    );
    expect(rows[0]).toEqual({ status: "done", shop_id: shop[0].id });
  });
});
