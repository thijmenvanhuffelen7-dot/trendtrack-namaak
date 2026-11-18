/**
 * Het hoofdpad van een klant: aanmelden, shop opzoeken, ad opslaan, upgraden, API-key maken
 * en een MCP-tool aanroepen. Upgraden gaat via een ondertekende Stripe-webhook (zoals Stripe
 * hem na een betaling stuurt), zodat de test geen echte betaling of Stripe-netwerk nodig heeft.
 */
import { expect, test, type Page } from "@playwright/test";
import Stripe from "stripe";

const MCP_URL = process.env.E2E_MCP_URL ?? "http://localhost:3333/mcp";
const email = `e2e-${Date.now()}@test.local`;

async function magicLink(to: string): Promise<string> {
  const base = process.env.MAILPIT_URL!;
  for (let i = 0; i < 30; i++) {
    const search = await fetch(
      `${base}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    ).then((r) => r.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const msg = await fetch(`${base}/api/v1/message/${id}`).then((r) => r.json());
      const link = String(msg.Text ?? msg.HTML).match(
        /https?:\/\/[^\s"<>)]+(?:auth\/confirm|verify)\?[^\s"<>)]+/,
      )?.[0];
      if (link) return link.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Geen inlogmail voor ${to} in Mailpit`);
}

test.describe.serial("golden path", () => {
  let page: Page;
  let workspaceId = "";
  let apiKey = "";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test("aanmelden met een magic link", async () => {
    await page.goto("/login");
    await page.getByRole("tab", { name: "Inloglink" }).click();
    await page.fill("#link-email", email);
    await page.click("button:has-text('Stuur inloglink')");
    await expect(page.getByText(email)).toBeVisible();
    await page.goto(await magicLink(email));
    await page.waitForURL(/\/app/);
    const svc = {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    };
    const [profile] = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id`,
      { headers: svc },
    ).then((r) => r.json());
    const [member] = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/workspace_members?user_id=eq.${profile.id}&select=workspace_id`,
      { headers: svc },
    ).then((r) => r.json());
    workspaceId = member.workspace_id;
    expect(workspaceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("een shop opzoeken", async () => {
    await page.goto("/app/shops?q=zilverzand");
    await page.locator("a[href='/app/shops/zilverzand.nl']:visible").first().click();
    await page.waitForURL(/\/app\/shops\/zilverzand\.nl/);
    await expect(page.locator("h1").first()).toContainText(/zilverzand/i);
    // Omzet is altijd een schatting met bandbreedte.
    await expect(page.getByText(/schatting/i).first()).toBeVisible();
  });

  test("sorteren en filteren binnen dezelfde pagina", async () => {
    // Regressie: met loading.tsx bleef zo'n navigatie in productie hangen.
    await page.goto("/app/shops");
    await page.locator("a[href*='sort=']").first().click();
    await expect(page).toHaveURL(/sort=/);
  });

  test("een ad opslaan in een folder", async () => {
    await page.goto("/app/ads");
    await page.locator("article a").first().click();
    await page.waitForSelector("[role=dialog]");
    await page.fill("[role=dialog] input[name=new_name]", "E2E winnaars");
    await page.click("[role=dialog] button:has-text('Opslaan in folder')");
    await expect(page.locator("[role=dialog] form span[role=status]")).toContainText("Opgeslagen");
    await page.goto("/app/folders");
    await expect(page.getByText("E2E winnaars")).toBeVisible();
  });

  test("upgraden naar Pro (ondertekende Stripe-webhook)", async ({ request }) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    test.skip(!secret, "STRIPE_WEBHOOK_SECRET ontbreekt in .env.local");
    const send = async (type: string, object: unknown, id: string) => {
      const payload = JSON.stringify({
        id,
        object: "event",
        type,
        created: Math.floor(Date.now() / 1000),
        data: { object },
      });
      const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: secret! });
      const res = await request.post("/api/stripe/webhook", {
        data: payload,
        headers: { "stripe-signature": signature, "content-type": "application/json" },
      });
      expect(res.status(), await res.text()).toBe(200);
    };
    const now = Math.floor(Date.now() / 1000);
    await send(
      "checkout.session.completed",
      { client_reference_id: workspaceId, customer: `cus_e2e_${workspaceId}`, metadata: {} },
      `evt_e2e_a_${workspaceId}`,
    );
    await send(
      "customer.subscription.created",
      {
        id: `sub_e2e_${workspaceId}`,
        object: "subscription",
        customer: `cus_e2e_${workspaceId}`,
        status: "active",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: { workspace_id: workspaceId },
        items: {
          data: [
            {
              id: "si_e2e",
              quantity: 1,
              current_period_start: now,
              current_period_end: now + 30 * 86400,
              price: { id: "price_e2e", lookup_key: "pro_month", metadata: {} },
            },
          ],
        },
      },
      `evt_e2e_b_${workspaceId}`,
    );
    await page.goto("/app/settings/billing");
    await expect(page.locator("main")).toContainText("Pro");
    await expect(page.locator("main")).not.toContainText("gratis Pro");
  });

  test("een API-key maken en de REST API aanroepen", async ({ request }) => {
    await page.goto("/app/api");
    await page.fill("#key-name", "E2E");
    await page.click("button:has-text('Key maken')");
    apiKey = await page.locator("[role=status] input[readonly]").inputValue();
    expect(apiKey).toMatch(/^tt_live_/);
    const res = await request.get("/api/v1/shops?limit=1", {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).data).toHaveLength(1);
  });

  test("een MCP-tool aanroepen met de API-key", async ({ request }) => {
    const call = (body: unknown) =>
      request.post(MCP_URL, {
        data: body,
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
      });
    const unauth = await request.post(MCP_URL, {
      data: {},
      headers: { "content-type": "application/json" },
    });
    expect(unauth.status()).toBe(401);
    const init = await call({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "e2e", version: "1" },
      },
    });
    expect(init.status()).toBe(200);
    const res = await call({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_shop", arguments: { domain: "zilverzand.nl" } },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.result.isError ?? false).toBe(false);
    expect(JSON.stringify(json.result.content)).toContain("zilverzand.nl");
  });
});
