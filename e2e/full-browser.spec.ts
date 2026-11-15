/**
 * Volledige browsertest: elke pagina en elke functie, in een echte Chromium.
 * Elke stap faalt bij een JavaScript-fout, een console-error of een mislukte request naar onze eigen
 * server. Draait tegen een lopende stack (zie playwright.config.ts).
 */
import { createHash, randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const MCP = process.env.E2E_MCP_URL ?? "http://localhost:3333/mcp";
const svc = () => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  "content-type": "application/json",
  prefer: "return=representation",
});
const rest = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...svc(), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

/** Verzamelt fouten op een pagina. `allow` = URL-patronen waarvan een foutstatus verwacht is. */
function guard(page: Page, allow: RegExp[] = []) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location().url ?? "";
    if (/Failed to load resource/.test(m.text()) && allow.some((a) => a.test(url))) return;
    errors.push(`console: ${m.text()} @ ${url}`);
  });
  page.on("response", (r) => {
    const url = r.url();
    if (!url.startsWith(BASE) || r.status() < 400 || allow.some((a) => a.test(url))) return;
    errors.push(`HTTP ${r.status()}: ${url}`);
  });
  page.on("requestfailed", (r) => {
    const f = r.failure()?.errorText ?? "";
    // Afgebroken prefetches en navigaties zijn normaal.
    if (f.includes("ERR_ABORTED") || !r.url().startsWith(BASE)) return;
    errors.push(`requestfailed: ${r.url()} ${f}`);
  });
  return {
    errors,
    clean: () => expect(errors, errors.join("\n")).toEqual([]),
  };
}

async function noHorizontalScroll(page: Page) {
  const { sw, w } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    w: window.innerWidth,
  }));
  expect(sw, `horizontaal scrollen op ${page.url()}`).toBeLessThanOrEqual(w);
}

async function magicLinkLogin(
  browser: Browser,
  email: string,
  viewport = { width: 1360, height: 900 },
) {
  const page = await browser.newPage({ viewport });
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.click("form button[type=submit] >> nth=0");
  await expect(page.getByText(email)).toBeVisible();
  let link: string | undefined;
  for (let i = 0; i < 40 && !link; i++) {
    const s = await fetch(
      `${process.env.MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    ).then((r) => r.json());
    const id = s.messages?.[0]?.ID;
    if (id) {
      const msg = await fetch(`${process.env.MAILPIT_URL}/api/v1/message/${id}`).then((r) =>
        r.json(),
      );
      link = String(msg.Text).match(
        /https?:\/\/[^\s"<>)]+(?:auth\/confirm|verify)\?[^\s"<>)]+/,
      )?.[0];
    }
    if (!link) await page.waitForTimeout(300);
  }
  expect(link, "inlogmail met link").toBeTruthy();
  await page.goto(link!);
  await page.waitForURL(/\/app/);
  return page;
}

// ---------------------------------------------------------------------------------------------
// Publieke site
// ---------------------------------------------------------------------------------------------

const PUBLIC = [
  "/",
  "/tools",
  "/tools/shopify-theme-detector",
  "/tools/shopify-apps-detector",
  "/tools/shopify-product-exporter",
  "/tools/winnende-ads-finder",
  "/tools/roas-break-even-calculator",
  "/tools/winstmarge-calculator",
  "/tools/clv-calculator",
  "/prijzen",
  "/blog",
  "/blog/omzet-shopify-store-checken",
  "/blog/alternatieven-voor-shopify-spy-tools",
  "/affiliate",
  "/privacy",
  "/voorwaarden",
  "/opt-out",
  "/schattingen",
  "/docs/api",
  "/login",
];

test.describe("publieke site", () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`alle pagina's laden zonder fouten (${viewport.width}px)`, async ({ browser }) => {
      const page = await browser.newPage({ viewport });
      const g = guard(page);
      for (const path of PUBLIC) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBe(200);
        await expect(page.locator("h1").first(), path).toBeVisible();
        expect(await page.title(), path).not.toBe("");
        await noHorizontalScroll(page);
        // Elke afbeelding is geladen en heeft alt-tekst.
        const broken = await page.evaluate(() =>
          [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
        );
        expect(broken, `kapotte afbeeldingen op ${path}`).toEqual([]);
        expect(await page.locator("img:not([alt])").count(), `img zonder alt op ${path}`).toBe(0);
      }
      g.clean();
    });
  }

  test("elke interne link op de publieke site werkt", async ({ browser, request }) => {
    const page = await browser.newPage();
    const links = new Set<string>();
    for (const path of PUBLIC) {
      await page.goto(path);
      for (const h of await page
        .locator("a[href^='/']")
        .evaluateAll((as) => as.map((a) => a.getAttribute("href")!)))
        links.add(h.split("#")[0]!);
    }
    const bad: string[] = [];
    for (const href of links) {
      const res = await request.get(href, { maxRedirects: 0 });
      // 307 naar /login voor het dashboard is goed; 404/500 niet.
      if (res.status() >= 400) bad.push(`${res.status()} ${href}`);
    }
    expect(bad).toEqual([]);
    expect(links.size).toBeGreaterThan(20);
  });

  test("API-documentatie toont de endpoints en het OpenAPI-bestand", async ({ page, request }) => {
    await page.goto("/docs/api");
    expect(await page.locator("article").count()).toBeGreaterThan(5);
    const spec = await (await request.get("/api/v1/openapi.json")).json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths).length).toBeGreaterThan(5);
  });

  test("onbekende pagina geeft een nette 404", async ({ page }) => {
    const res = await page.goto("/bestaat-niet-xyz");
    expect(res?.status()).toBe(404);
    // Regressie: na een onbekende slug gaf een bekende blogpost ineens 404 (dynamicParams = false).
    for (const path of ["/blog/bestaat-niet", "/tools/bestaat-niet"])
      expect((await page.goto(path))?.status()).toBe(404);
    for (const path of ["/blog/omzet-shopify-store-checken", "/tools/clv-calculator"])
      expect((await page.goto(path))?.status()).toBe(200);
  });

  test("landing: live schatting in de hero", async ({ page }) => {
    const g = guard(page);
    await page.goto("/");
    const input = page.locator("main form input").first();
    await input.fill("zilverzand.nl");
    await page.locator("main form button[type=submit]").first().click();
    await expect(page.locator("main")).toContainText(/Zilverzand/);
    await expect(page.locator("main")).toContainText(/€/);
    g.clean();
  });

  test("landing en prijzen: betaaltermijn wisselen verandert de prijzen", async ({ page }) => {
    const g = guard(page);
    for (const path of ["/", "/prijzen"]) {
      await page.goto(path);
      const table = page.locator("#pricing-title").locator("xpath=ancestor::section[1]");
      const before = await table.innerText();
      await table.getByRole("radio", { name: /jaar/i }).first().click();
      await expect.poll(async () => (await table.innerText()) !== before).toBe(true);
    }
    g.clean();
  });

  test("calculators rekenen goed", async ({ page }) => {
    const g = guard(page);
    await page.goto("/tools/winstmarge-calculator");
    await page.fill("#c-price", "60");
    await expect(page.locator("ul[aria-live]")).toContainText("€ 27,95");
    await expect(page.locator("ul[aria-live]")).toContainText("56,36%");
    await page.goto("/tools/roas-break-even-calculator");
    await expect(page.locator("ul[aria-live]")).toContainText("2,52");
    await page.fill("#c-cost", "100"); // duurder dan de prijs: geen winst
    await expect(page.locator("ul[aria-live]")).toContainText("Geen winst");
    await page.goto("/tools/clv-calculator");
    await page.fill("#v-aov", "100");
    await page.fill("#v-orders", "2");
    await page.fill("#v-years", "1");
    await page.fill("#v-margin", "50");
    await page.fill("#v-vat", "0");
    await expect(page.locator("ul[aria-live]")).toContainText("€ 100,00"); // 200 omzet × 50%
    g.clean();
  });

  test("winnende-ads-finder toont resultaten en verwijst naar login", async ({ page }) => {
    const g = guard(page);
    await page.goto("/tools/winnende-ads-finder");
    await page.fill("#ads-q", "gratis");
    await page.click("button:has-text('Zoek ads')");
    await expect(page.locator("ol li").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Zie alles met een gratis account/ }),
    ).toBeVisible();
    await page.fill("#ads-q", "zzzgeenresultaatzzz");
    await page.click("button:has-text('Zoek ads')");
    await expect(page.getByText(/Geen lopende ads/)).toBeVisible();
    g.clean();
  });

  test("detector en exporter: duidelijke melding bij ongeldig of onbereikbaar domein", async ({
    page,
  }) => {
    // Deze testomgeving heeft geen internet: echte shops zijn onbereikbaar. We testen de foutpaden.
    await rest("public_rate_counters?tool=in.(detect,products)", { method: "DELETE" });
    const g = guard(page, [/\/api\/public\/(detect|products)/]);
    for (const [path, button] of [
      ["/tools/shopify-theme-detector", "Zoek het thema"],
      ["/tools/shopify-apps-detector", "Zoek de apps"],
      ["/tools/shopify-product-exporter", "Haal producten op"],
    ] as const) {
      await page.goto(path);
      await page.fill("#tool-domain", "niet-een-domein");
      await page.click(`button:has-text('${button}')`);
      await expect(page.getByText(/geldig domein/)).toBeVisible();
      await page.fill("#tool-domain", "onbereikbaar-voorbeeld-xyz.nl");
      await page.click(`button:has-text('${button}')`);
      await expect(page.locator("div.mt-8[aria-live]")).toContainText(/bereikbaar|niet|lukte/i);
    }
    g.clean();
  });

  test("mobiel menu en footer-links", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const g = guard(page);
    await page.goto("/");
    await page.locator("nav[aria-label=Menu] a[href='/prijzen']").click();
    await expect(page).toHaveURL(/\/prijzen$/);
    await page.locator("footer a[href='/opt-out']").click();
    await expect(page).toHaveURL(/\/opt-out$/);
    g.clean();
  });

  test("opt-out-formulier: limiet per IP", async ({ page }) => {
    await rest("public_rate_counters?tool=eq.optout", { method: "DELETE" });
    for (let i = 0; i < 6; i++) {
      await page.goto("/opt-out");
      await page.fill("#oo-domain", `limiet-${i}-${Date.now().toString(36)}.nl`);
      await page.fill("#oo-email", "x@example.com");
      await page.check("#oo-owner");
      await page.click("button:has-text('Verwijder mijn shop')");
      if (i < 5) await expect(page.getByRole("status")).toContainText("Ontvangen");
      else await expect(page.getByText("Te veel verzoeken vanaf dit adres")).toBeVisible();
    }
    await rest("public_rate_counters?tool=eq.optout", { method: "DELETE" });
  });

  test("affiliate-link wordt onthouden", async ({ page, context }) => {
    await page.goto("/?ref=partner-e2e");
    expect((await context.cookies()).find((c) => c.name === "ref")?.value).toBe("partner-e2e");
  });
});

// ---------------------------------------------------------------------------------------------
// Inloggen en afscherming
// ---------------------------------------------------------------------------------------------

test.describe("afscherming", () => {
  test("dashboard, admin en folders vragen om inloggen", async ({ page }) => {
    for (const path of ["/app/shops", "/app/settings/billing", "/admin", "/app/folders"]) {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/%2F/g, "(%2F|/)")}`),
      );
    }
  });

  test("REST API en MCP zonder of met foute key", async ({ request }) => {
    expect((await request.get("/api/v1/shops")).status()).toBe(401);
    expect(
      (
        await request.get("/api/v1/shops", { headers: { authorization: "Bearer tt_live_fout" } })
      ).status(),
    ).toBe(401);
    const mcp = await request.post(MCP, {
      data: {},
      headers: { "content-type": "application/json" },
    });
    expect(mcp.status()).toBe(401);
    expect(mcp.headers()["www-authenticate"]).toContain("resource_metadata");
  });
});

// ---------------------------------------------------------------------------------------------
// Dashboard: elke pagina en functie als ingelogde gebruiker
// ---------------------------------------------------------------------------------------------

test.describe.serial("dashboard", () => {
  const email = `full-${Date.now()}@test.local`;
  let page: Page;
  let g: ReturnType<typeof guard>;
  let userId = "";
  let workspaceId = "";

  test.beforeAll(async ({ browser }) => {
    page = await magicLinkLogin(browser, email);
    g = guard(page);
    const [profile] = await rest(`profiles?email=eq.${encodeURIComponent(email)}&select=id`);
    userId = profile.id;
    const [member] = await rest(`workspace_members?user_id=eq.${userId}&select=workspace_id`);
    workspaceId = member.workspace_id;
  });

  test.afterEach(() => g.clean());

  test("ingelogd naar /login gaat door naar het dashboard", async () => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/app\/shops/);
  });

  test("elke dashboardpagina laadt (desktop)", async () => {
    for (const path of [
      "/app",
      "/app/shops",
      "/app/ads",
      "/app/advertisers",
      "/app/emails",
      "/app/brandtracker",
      "/app/folders",
      "/app/api",
      "/app/mcp",
      "/app/settings",
      "/app/settings/billing",
      "/app/settings/affiliate",
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator("h1").first(), path).toBeVisible();
      await noHorizontalScroll(page);
    }
  });

  test("navigatie via de zijbalk", async () => {
    await page.goto("/app/shops");
    for (const [href, h1] of [
      ["/app/ads", "Ads"],
      ["/app/advertisers", "Adverteerders"],
      ["/app/emails", "E-mails"],
      ["/app/folders", "Folders"],
      ["/app/shops", "Shops"],
    ]) {
      await page
        .locator(`aside nav a[href='${href}'], aside a[href='${href}']:not(.font-semibold)`)
        .first()
        .click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.locator("h1").first()).toHaveText(h1);
    }
  });

  test("shops: filteren, sorteren, wissen", async () => {
    await page.goto("/app/shops");
    const rows = page.locator("a[href^='/app/shops/']");
    const all = await rows.count();
    expect(all).toBeGreaterThan(1);
    await page.selectOption("#f-country", "BE");
    await page.click("main form button:has-text('Filteren')");
    await expect(page).toHaveURL(/country=BE/);
    await expect(page.locator("main")).toContainText("bosbad.be");
    await expect(page.locator("main")).not.toContainText("zilverzand.nl");
    await page.goto("/app/shops");
    await page.locator("a[href='/app/shops?sort=name']").click();
    await expect(page).toHaveURL(/sort=name/);
    const names = await page.locator("tbody tr td:first-child").allInnerTexts();
    expect(names.length).toBeGreaterThan(1);
    expect([...names].sort((a, b) => a.localeCompare(b, "nl"))).toEqual(names);
    // Eerst de sorteer-navigatie laten afronden; anders tekent die het formulier opnieuw en is de invoer weg.
    await page.waitForLoadState("networkidle");
    // Regressie: met step={1000} weigerde de browser getallen als 999999999 of 12500 stilletjes.
    await page.fill("#f-rev-min", "999999999");
    await page.fill("#f-growth", "0.33");
    await page.click("main form button:has-text('Filteren')");
    await expect(page).toHaveURL(/revenue_min=999999999/);
    await expect(page).toHaveURL(/growth_min=0.33/);
    await expect(page.locator("main")).toContainText(/Geen|geen/);
  });

  test("zoeken in de bovenbalk", async () => {
    await page.goto("/app/ads");
    await page.locator("header input[name=q], input[name=q]").first().fill("zilverzand.nl");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/app\/shops\/zilverzand\.nl/);
  });

  test("shop-detail: alle tabs, schatting als bandbreedte", async () => {
    await page.goto("/app/shops/zilverzand.nl");
    await expect(page.locator("h1")).toHaveText("Zilverzand Sieraden");
    await expect(page.getByText(/schatting/i).first()).toBeVisible();
    for (const tab of ["products", "ads", "emails", "tech"]) {
      await page.locator(`a[href='/app/shops/zilverzand.nl?tab=${tab}']`).first().click();
      await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
      await expect(page.locator("main")).not.toBeEmpty();
    }
    await page.locator("a[href='/app/shops/zilverzand.nl?tab=tech']").first().click();
    await expect(page.locator("main")).toContainText(/Dawn/);
  });

  test("shop volgen in de Brandtracker en weer ontvolgen", async () => {
    await page.goto("/app/shops/zilverzand.nl");
    await page.click("button:has-text('Volg in Brandtracker')");
    await expect(page.getByRole("button", { name: /Gevolgd/ })).toBeVisible();
    await page.goto("/app/brandtracker");
    await expect(page.locator("main")).toContainText("Zilverzand");
    await page.getByRole("button", { name: "Samenvatting uit" }).click();
    await expect(page.getByRole("button", { name: "Samenvatting aan" })).toBeVisible();
    await page.getByRole("button", { name: "Samenvatting aan" }).click();
    await expect(page.getByRole("button", { name: "Samenvatting uit" })).toBeVisible();
    await page.goto("/app/shops/zilverzand.nl");
    await page.getByRole("button", { name: /Gevolgd/ }).click();
    await expect(page.getByRole("button", { name: /Volg in Brandtracker/ })).toBeVisible();
  });

  test("shop opslaan in een nieuwe folder", async () => {
    await page.goto("/app/shops/zilverzand.nl");
    await page.locator("main form input[name=new_name]").first().fill("Concurrenten");
    await page.locator("main button:has-text('Opslaan in folder')").first().click();
    await expect(page.locator("main form [role=status]").first()).toContainText("Opgeslagen");
  });

  test("ads: filteren, paneel openen, opslaan, sluiten", async () => {
    await page.goto("/app/ads");
    const total = await page.locator("article").count();
    expect(total).toBeGreaterThan(1);
    await page.fill("#a-q", "gratis verzending");
    await page.click("main form button:has-text('Filteren')");
    await expect(page).toHaveURL(/q=gratis/);
    await expect(page.locator("article").first()).toBeVisible();
    await page.goto("/app/ads");
    await page.selectOption("#a-sort", { index: 1 });
    await page.click("main form button:has-text('Filteren')");
    await expect(page).toHaveURL(/sort=/);
    await page.locator("article a").first().click();
    const dialog = page.locator("[role=dialog]");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("iframe")).toHaveAttribute("sandbox", "");
    await dialog.locator("select[name=folder_id]").selectOption({ label: "Concurrenten" });
    await dialog.locator("button:has-text('Opslaan in folder')").click();
    await expect(dialog.locator("form span[role=status]")).toContainText("Opgeslagen");
    await dialog.locator("a[aria-label=Sluiten]").last().click();
    await expect(dialog).toBeHidden();
  });

  test("adverteerders: zoeken en doorklikken naar hun ads", async () => {
    await page.goto("/app/advertisers");
    await page.fill("#adv-q", "Bosbad");
    await page.click("main form button:has-text('Filteren')");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.locator("a[href^='/app/ads?advertiser_id=']").first().click();
    await expect(page).toHaveURL(/advertiser_id=/);
    await expect(page.locator("article").first()).toBeVisible();
  });

  test("e-mails: filteren op type en een mail openen in een veilige iframe", async () => {
    await page.goto("/app/emails");
    await page.selectOption("#e-type", "welcome");
    await page.click("main form button:has-text('Filteren')");
    await expect(page).toHaveURL(/type=welcome/);
    await page.goto("/app/emails");
    await page.locator("a[href^='/app/emails/']").first().click();
    await expect(page).toHaveURL(/\/app\/emails\/[0-9a-f-]{36}/);
    await expect(page.locator("h1")).toBeVisible();
    // Met HTML: in een iframe zonder scripts; zonder (zoals de seedmails): de tekstversie.
    const frame = page.locator("main iframe");
    if (await frame.count()) {
      const sandbox = (await frame.getAttribute("sandbox")) ?? "";
      expect(sandbox).not.toContain("allow-scripts");
      expect(sandbox).not.toContain("allow-same-origin");
    } else {
      await expect(page.locator("main")).toContainText("alleen de tekst bewaard");
    }
    await page.locator("main select[name=folder_id]").selectOption({ label: "Concurrenten" });
    await page.locator("main button:has-text('Opslaan in folder')").click();
    await expect(page.locator("main form [role=status]")).toContainText("Opgeslagen");
  });

  test("folders: inhoud, delen via link (uitgelogd te bekijken), item eruit, folder weg", async ({
    browser,
  }) => {
    await page.goto("/app/folders");
    await page.getByRole("link", { name: /Concurrenten/ }).click();
    await expect(page.locator("h1")).toContainText("Concurrenten");
    await expect(page.locator("main")).toContainText("Zilverzand");
    await page.getByRole("button", { name: "Delen via link" }).click();
    const shareUrl = await page.locator("main input[readonly]").first().inputValue();
    expect(shareUrl).toMatch(/\/share\//);
    const anon = await browser.newPage();
    const ga = guard(anon);
    await anon.goto(shareUrl);
    await expect(anon.locator("main")).toContainText("Zilverzand");
    ga.clean();
    await page.getByRole("button", { name: "Delen uitzetten" }).click();
    await expect(page.locator("main input[readonly]")).toHaveCount(0);
    const gone = await anon.goto(shareUrl);
    expect(gone?.status()).toBe(404);
    await anon.close();
    const before = await page.locator("button[aria-label='Uit folder halen']").count();
    await page.locator("button[aria-label='Uit folder halen']").first().click();
    await expect(page.locator("button[aria-label='Uit folder halen']")).toHaveCount(before - 1);
    await page.getByRole("button", { name: "Folder verwijderen" }).click();
    await expect(page).toHaveURL(/\/app\/folders$/);
    await expect(page.locator("main")).not.toContainText("Concurrenten");
  });

  test("folder aanmaken vanaf de folderpagina", async () => {
    await page.goto("/app/folders");
    await page.fill("#folder-name", "Inspiratie");
    await page.click("button:has-text('Aanmaken')");
    await expect(page).toHaveURL(/\/app\/folders\/[0-9a-f-]{36}/);
    await expect(page.locator("h1")).toContainText("Inspiratie");
  });

  test("onbekende shop opvragen zet hem in de wachtrij", async () => {
    const unknown = `onbekend-${Date.now().toString(36)}.nl`;
    await page.goto(`/app/shops/${unknown}`);
    await expect(page.locator("main")).toContainText("kennen we nog niet");
    await page.click("button:has-text('Shop ophalen')");
    await expect(page.locator("main")).toContainText(
      /We halen|aan het ophalen|niet bereikbaar|niet gelukt/,
    );
    const rows = await rest(`lookup_requests?domain=eq.${unknown}&select=status`);
    expect(rows.length).toBe(1);
    // De worker pakt hem op (status verandert); de pagina ververst vanzelf mee.
    await expect
      .poll(
        async () => (await rest(`lookup_requests?domain=eq.${unknown}&select=status,error`))[0],
        { timeout: 60_000 },
      )
      .not.toMatchObject({ status: "queued", error: null });
    await expect(page.locator("main")).toContainText(
      /aan het ophalen|niet bereikbaar|lukt nog niet|niet gelukt|bestaat niet/,
      { timeout: 30_000 },
    );
  });

  test("API-key maken, gebruiken en intrekken", async ({ request }) => {
    await page.goto("/app/api");
    await page.fill("#key-name", "Volledige test");
    await page.click("button:has-text('Key maken')");
    const key = await page.locator("[role=status] input[readonly]").inputValue();
    expect(key).toMatch(/^tt_live_/);
    const ok = await request.get("/api/v1/shops?limit=2", {
      headers: { authorization: `Bearer ${key}` },
    });
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(body.data[0].monthly_revenue.estimate).toBe(true);
    const mcp = await request.post(MCP, {
      data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      headers: {
        authorization: `Bearer ${key}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
    });
    expect((await mcp.json()).result.tools.length).toBe(12);
    await page.reload();
    expect(await page.content()).not.toContain(key); // alleen eenmalig zichtbaar
    await page
      .locator("tbody tr")
      .filter({ hasText: "Volledige test" })
      .getByRole("button", { name: "Intrekken" })
      .click();
    await expect(page.locator("tbody tr").filter({ hasText: "Volledige test" })).toContainText(
      "Ingetrokken",
    );
    expect(
      (
        await request.get("/api/v1/shops", { headers: { authorization: `Bearer ${key}` } })
      ).status(),
    ).toBe(401);
  });

  test("MCP-pagina: URL kopiëren", async () => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    await page.goto("/app/mcp");
    await page.getByRole("button", { name: "Kopiëren" }).first().click();
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
    expect(clip).toMatch(/\/mcp$/);
  });

  test("taal wisselen naar Engels en terug", async () => {
    await page.goto("/app/settings");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("h1")).toHaveText("Settings");
    await page.goto("/app/ads");
    await expect(page.locator("h1")).toHaveText("Ads");
    await expect(page.locator("main form button[type=submit]").first()).toHaveText("Filter");
    await page.goto("/app/settings");
    await page.getByRole("button", { name: "Nederlands" }).click();
    await expect(page.locator("h1")).toHaveText("Instellingen");
  });

  test("abonnement: termijnen en proefperiode", async () => {
    await page.goto("/app/settings/billing");
    await expect(page.locator("main")).toContainText(/gratis Pro|proef/i);
    const month = await page.locator("main").innerText();
    await page.locator("a[href='/app/settings/billing?interval=year']").click();
    await expect(page).toHaveURL(/interval=year/);
    expect(await page.locator("main").innerText()).not.toBe(month);
    if (!process.env.STRIPE_SECRET_KEY) {
      // Zonder Stripe-key: duidelijke melding en uitgeschakelde knoppen in plaats van een crash.
      await expect(page.getByRole("button", { name: "Kies Pro" })).toBeDisabled();
    }
  });

  test("affiliate: code kiezen, link en telling zien", async () => {
    await page.goto("/app/settings/affiliate");
    await page.fill("#aff-code", "ongeldig met spaties");
    await page.click("button:has-text('Maak mijn link')");
    await expect(page).toHaveURL(/settings\/affiliate/); // browser-validatie of fout, geen code
    const code = `e2e-${Date.now().toString(36)}`;
    await page.fill("#aff-code", code);
    await page.click("button:has-text('Maak mijn link')");
    await expect(page.locator("main")).toContainText(`?ref=${code}`);
    await expect(page.locator("main")).toContainText("30%");
  });

  test("limieten op het gratis plan", async () => {
    await rest(`subscriptions?workspace_id=eq.${workspaceId}`, { method: "DELETE" });
    await page.goto("/app/shops/zilverzand.nl");
    await page.click("button:has-text('Volg in Brandtracker')");
    await expect(page.locator("form [role=alert]").first()).toBeVisible();
    await page.goto("/app/folders");
    await page.fill("#folder-name", "Nog een");
    await page.click("button:has-text('Aanmaken')");
    await expect(page.locator("[role=alert]").first()).toBeVisible();
    await page.goto("/app/settings/billing");
    await expect(page.locator("main")).toContainText(/Gratis|Free/);
  });

  test("dashboard op mobiel", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: await page.context().storageState(),
    });
    const m = await ctx.newPage();
    const gm = guard(m);
    for (const path of [
      "/app/shops",
      "/app/shops/zilverzand.nl",
      "/app/ads",
      "/app/emails",
      "/app/folders",
      "/app/api",
      "/app/settings/billing",
    ]) {
      await m.goto(path);
      await expect(m.locator("h1").first(), path).toBeVisible();
      await noHorizontalScroll(m);
    }
    await m.goto("/app/ads");
    await m.locator("article a").first().click();
    await expect(m.locator("[role=dialog]")).toBeVisible();
    gm.clean();
    await ctx.close();
  });

  test("uitloggen", async () => {
    await page.goto("/app/settings");
    await page.locator("aside form[action='/auth/signout'] button").click();
    await expect(page).toHaveURL(/\/login|\/$/);
    await page.goto("/app/shops");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

test.describe.serial("admin", () => {
  let page: Page;
  let g: ReturnType<typeof guard>;
  const domain = `optout-e2e-${Date.now().toString(36)}.nl`;

  test.beforeAll(async ({ browser }) => {
    const email = `admin-${Date.now()}@test.local`;
    page = await magicLinkLogin(browser, email);
    g = guard(page);
    await rest(`profiles?email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH",
      body: JSON.stringify({ is_admin: true }),
    });
    await rest("shops", {
      method: "POST",
      body: JSON.stringify({ domain, name: "Opt-out testshop" }),
    });
  });
  test.afterEach(() => g.clean());

  test("gewone gebruiker krijgt 404 op /admin", async ({ browser }) => {
    const p = await magicLinkLogin(browser, `geen-admin-${Date.now()}@test.local`);
    const res = await p.goto("/admin");
    expect(res?.status()).toBe(404);
    await p.close();
  });

  test("admin-pagina's laden", async () => {
    for (const path of ["/admin", "/admin/jobs", "/admin/inboxes", "/admin/opt-out"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator("h1").first(), path).toBeVisible();
    }
  });

  let createdInbox = false;
  test.afterAll(async () => {
    // Eigen testdata opruimen, zodat de integratietests (die op de seed rekenen) blijven kloppen.
    await rest("emails?subject=like.Testmail*", { method: "DELETE" });
    if (createdInbox)
      await rest(
        "seed_inboxes?address=not.like.*%40inbox.test.local&shop_id=eq.11111111-0000-0000-0000-000000000002",
        { method: "DELETE" },
      );
  });

  test("seed-inbox aanmaken", async () => {
    createdInbox =
      (await rest("seed_inboxes?shop_id=eq.11111111-0000-0000-0000-000000000002&select=id"))
        .length === 0;
    await page.goto("/admin/inboxes");
    const form = page.locator("form:has(input[name=domain][required])");
    await form.locator("input[name=domain]").fill("bosbad.be");
    await form.locator("button[type=submit]").click();
    await expect(page.locator("body")).toContainText(/(Aangemaakt|Bestond al): .+@/);
    const row = page.locator("tbody tr").filter({ hasText: "bosbad.be" });
    await row.getByRole("button", { name: /Ingeschreven|Opnieuw/ }).click();
    await expect(row).toContainText(/Opnieuw: nu/);
  });

  test("inkomende HTML-mail: opgeslagen, gesaneerd en veilig getoond", async ({ request }) => {
    const [inbox] = await rest(
      "seed_inboxes?select=address,shops!inner(domain)&shops.domain=eq.bosbad.be",
    );
    const subject = `Testmail ${Date.now()}`;
    const res = await request.post("/api/inbound/postmark", {
      headers: {
        authorization: `Basic ${Buffer.from(`postmark:${process.env.INBOUND_WEBHOOK_SECRET}`).toString("base64")}`,
      },
      data: {
        From: "Bosbad <nieuws@bosbad.be>",
        FromFull: { Email: "nieuws@bosbad.be" },
        To: inbox.address,
        OriginalRecipient: inbox.address,
        Subject: subject,
        HtmlBody: `<h1>Zomersale</h1><p>Tot 30% korting</p><script>parent.__pwned = 1</script><img src="x" onerror="parent.__pwned = 2"><a href="https://bosbad.be/sale?utm_source=mail">Shop nu</a>`,
        TextBody: "Zomersale. Tot 30% korting",
        MessageID: `e2e-${Date.now()}@bosbad.be`,
        Headers: [],
      },
    });
    expect(res.status(), await res.text()).toBe(200);
    expect((await request.post("/api/inbound/postmark", { data: {} })).status()).toBe(401);

    await page.goto("/app/emails?domain=bosbad.be");
    await page.getByRole("link", { name: new RegExp(subject) }).click();
    const frame = page.locator("main iframe");
    await expect(frame).toBeVisible();
    const sandbox = (await frame.getAttribute("sandbox")) ?? "";
    expect(sandbox).not.toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
    const html = (await frame.getAttribute("srcdoc")) ?? "";
    expect(html).toContain("Zomersale");
    expect(html).not.toMatch(/<script|onerror/i);
    await expect(page.frameLocator("main iframe").locator("h1")).toHaveText("Zomersale");
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
    ).toBeUndefined();
  });

  test("admin/jobs toont runs van de workers", async () => {
    // Zelf een job veroorzaken: een lookup die de worker oppakt (hangt niet van andere tests af).
    const [ws] = await rest("workspaces?select=id&limit=1");
    await rest("lookup_requests", {
      method: "POST",
      body: JSON.stringify({ workspace_id: ws.id, domain: `jobs-${Date.now().toString(36)}.nl` }),
    });
    await expect
      .poll(async () => (await rest("job_runs?select=id&limit=1")).length, { timeout: 60_000 })
      .toBeGreaterThan(0);
    await page.goto("/admin/jobs");
    await expect(page.locator("body")).toContainText(/shop\.detect|scheduler|monitor/);
  });

  test("opt-out: aanvraag via de site, goedkeuren, shop is overal weg", async ({
    browser,
    request,
  }) => {
    await rest("public_rate_counters?tool=eq.optout", { method: "DELETE" });
    const pub = await browser.newPage();
    await pub.goto("/opt-out");
    await pub.fill("#oo-domain", domain);
    await pub.fill("#oo-email", `eigenaar@${domain}`);
    await pub.check("#oo-owner");
    await pub.click("button:has-text('Verwijder mijn shop')");
    await expect(pub.getByRole("status")).toContainText("Ontvangen");
    await pub.close();

    await page.goto("/admin/opt-out");
    const row = page.locator("tbody tr").filter({ hasText: domain });
    await expect(row).toContainText("zelfde domein");
    await row.getByRole("button", { name: "Verwijderen" }).click();
    await expect(page.locator("tbody tr").filter({ hasText: domain })).toContainText("approved");

    expect(await rest(`shops?domain=eq.${domain}&select=id`)).toEqual([]);
    await page.goto(`/app/shops/${domain}`);
    await page.locator("button:has-text('Shop ophalen')").click();
    await expect(page.locator("main")).toContainText(/blokkeert|verwijderd/);
    const tool = await request.get(`/api/public/detect?domain=${domain}`);
    expect(tool.status()).toBe(410);
  });
});

// ---------------------------------------------------------------------------------------------
// OAuth voor MCP-clients (zoals Claude): registreren, inloggen, toestaan, token, tool
// ---------------------------------------------------------------------------------------------

test("OAuth 2.1 met PKCE: toestaan, weigeren en onbekende redirect", async ({ browser }) => {
  const r401 = await fetch(MCP, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const resMeta = await (
    await fetch(r401.headers.get("www-authenticate")!.match(/resource_metadata="([^"]+)"/)![1]!)
  ).json();
  const as = await (
    await fetch(`${resMeta.authorization_servers[0]}/.well-known/oauth-authorization-server`)
  ).json();
  const redirect = "http://localhost:9876/callback";
  const reg = await (
    await fetch(as.registration_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: "E2E-client", redirect_uris: [redirect] }),
    })
  ).json();
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authUrl = `${as.authorization_endpoint}?${new URLSearchParams({ response_type: "code", client_id: reg.client_id, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: "S256", state: "s1", resource: resMeta.resource })}`;

  const page = await magicLinkLogin(browser, `oauth-${Date.now()}@test.local`);
  const g = guard(page);
  let captured = "";
  await page.route("http://localhost:9876/**", (r) => {
    captured = r.request().url();
    return r.fulfill({ status: 200, body: "ok" });
  });
  await page.goto(authUrl);
  await expect(page.locator("main")).toContainText("E2E-client");
  await page.click("button:has-text('Toestaan')");
  await expect.poll(() => captured).toContain("code=");
  const cb = new URL(captured);
  expect(cb.searchParams.get("state")).toBe("s1");
  const tok = await (
    await fetch(as.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: cb.searchParams.get("code")!,
        client_id: reg.client_id,
        redirect_uri: redirect,
        code_verifier: verifier,
      }),
    })
  ).json();
  expect(tok.access_token).toMatch(/^tt_oat_/);
  const call = await (
    await fetch(MCP, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${tok.access_token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get_shop", arguments: { domain: "zilverzand.nl" } },
      }),
    })
  ).json();
  expect(call.result.content[0].text).toContain("Zilverzand");
  // Koppeling zichtbaar en in te trekken op /app/mcp
  await page.goto("/app/mcp");
  await expect(page.locator("main")).toContainText("E2E-client");

  captured = "";
  await page.goto(authUrl);
  await page.click("button:has-text('Weigeren')");
  await expect.poll(() => captured).toContain("error=access_denied");

  await page.goto(
    authUrl.replace(encodeURIComponent(redirect), encodeURIComponent("https://evil.example/x")),
  );
  await expect(page.locator("main")).not.toContainText("Toestaan");

  // Koppeling intrekken op /app/mcp: daarna werkt het token niet meer.
  await page.goto("/app/mcp");
  await page.locator("li").filter({ hasText: "E2E-client" }).getByRole("button").click();
  await expect(page.locator("main")).not.toContainText("E2E-client");
  const after = await fetch(MCP, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${tok.access_token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
  });
  expect(after.status).toBe(401);
  g.clean();
});
