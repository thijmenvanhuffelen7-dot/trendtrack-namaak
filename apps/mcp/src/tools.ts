import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PLANS, tryNormalizeDomain, type ShopFilters } from "@trendtrack/core";
import {
  checkAndRecordUsage,
  getAd,
  getAdvertiser,
  getShopByDomain,
  getShopFacets,
  getShopOverview,
  listAds,
  listAdvertisers,
  listEmails,
  listShopEvents,
  listShopProducts,
  listShops,
  listTrackedBrands,
  requestLookup,
  trackBrand,
  type ShopEventType,
} from "@trendtrack/db";
import {
  money,
  nextCursor,
  pageFrom,
  spend,
  toAd,
  toAdvertiser,
  toEmail,
  toProduct,
  toShop,
} from "@trendtrack/db/public-api";
import { z } from "zod";
import type { McpContext } from "./context";

/** Maximaal aantal items per antwoord; meer via `cursor`. Houdt antwoorden compact voor een AI. */
export const MAX_ITEMS = 50;

const ESTIMATE_NOTE =
  "Omzet, bestellingen en ad spend zijn schattingen (estimate: true), altijd als bandbreedte low–high.";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
});
const fail = (message: string): ToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

const limit = z
  .number()
  .int()
  .min(1)
  .max(MAX_ITEMS)
  .default(20)
  .describe(`Aantal resultaten (max ${MAX_ITEMS}).`);
const cursor = z
  .string()
  .max(200)
  .optional()
  .describe("next_cursor uit het vorige antwoord, voor meer resultaten.");
const country = z
  .string()
  .regex(/^[A-Za-z]{2}$/)
  .transform((s) => s.toUpperCase())
  .optional()
  .describe("Landcode, bv. NL of BE.");
const domain = z
  .string()
  .min(3)
  .max(253)
  .describe("Domein van de webshop, bv. zilverzand.nl (een URL mag ook).");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Korter maken van lange teksten zodat antwoorden compact blijven. */
const clip = (s: string | null, n = 280) => (s && s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * Registreert alle tools. Elke call loopt via checkAndRecordUsage (zelfde quotum als de REST API)
 * en wordt gelogd. Queries en serializers komen uit packages/db: geen eigen logica hier.
 */
export function registerTools(server: McpServer, ctx: McpContext) {
  const tool = <S extends z.ZodRawShape>(
    name: string,
    config: { title: string; description: string; inputSchema: S; readOnly?: boolean },
    run: (args: z.infer<z.ZodObject<S>>) => Promise<ToolResult>,
  ) => {
    server.registerTool(
      name,
      {
        title: config.title,
        description: config.description,
        inputSchema: config.inputSchema,
        annotations: { readOnlyHint: config.readOnly ?? true, openWorldHint: false },
      },
      // De SDK valideert de invoer al tegen het schema.
      (async (args: z.infer<z.ZodObject<S>>) => {
        const started = Date.now();
        const usage = await checkAndRecordUsage(ctx.db, ctx.workspaceId, "api_call", {
          source: "mcp",
          userId: ctx.userId,
        });
        if (!usage.allowed) {
          const upgrade = `${ctx.webOrigin}/app/settings/billing`;
          return fail(
            usage.reason === "not_in_plan"
              ? `De TrendTrack MCP-server zit niet in het ${PLANS[usage.plan].name}-plan. Upgrade naar Pro of Agency: ${upgrade}`
              : `Het maandquotum van ${usage.limit} calls is op (reset ${usage.resetsAt?.slice(0, 10)}). Upgrade: ${upgrade}`,
          );
        }
        try {
          const result = await run(args);
          ctx.log?.({
            tool: name,
            workspace: ctx.workspaceId,
            ms: Date.now() - started,
            ok: !result.isError,
          });
          return result;
        } catch (err) {
          ctx.log?.({
            tool: name,
            workspace: ctx.workspaceId,
            ms: Date.now() - started,
            ok: false,
            error: String(err),
          });
          return fail("Er ging iets mis bij het ophalen van de data. Probeer het later opnieuw.");
        }
      }) as never,
    );
  };

  tool(
    "list_filters",
    {
      title: "Beschikbare filters",
      description:
        "Geeft de landen, niches en thema's die in de database voorkomen. Gebruik dit eerst als de gebruiker een categorie noemt (bv. 'sieraden'), om de juiste niche-namen te vinden (bv. Kettingen, Oorbellen, Ringen).",
      inputSchema: {},
    },
    async () => ok(await getShopFacets(ctx.db)),
  );

  tool(
    "search_shops",
    {
      title: "Webshops zoeken",
      description:
        "Zoekt Benelux-webshops (vooral Shopify) op land, niche, thema, app, geschatte omzet, aantal actieve ads en groei. Gebruik voor vragen als 'snelgroeiende NL-shops in verzorging' of 'shops met Klaviyo'.",
      inputSchema: {
        query: z.string().max(200).optional().describe("Zoekterm in naam of domein."),
        country,
        niche: z.string().max(200).optional().describe("Exacte niche (zie list_filters)."),
        theme: z.string().max(100).optional().describe("Shopify-thema, bv. Dawn."),
        app: z.string().max(100).optional().describe("App-id, bv. klaviyo, judge-me, recharge."),
        min_monthly_revenue: z
          .number()
          .nonnegative()
          .optional()
          .describe("Minimale geschatte omzet per maand (EUR, middenwaarde)."),
        max_monthly_revenue: z.number().nonnegative().optional(),
        min_active_ads: z.number().int().nonnegative().optional(),
        min_growth: z.number().min(-1).max(1).optional().describe("Groeiscore −1..1."),
        sort: z.enum(["growth", "revenue", "ads", "newest", "name"]).default("growth"),
        limit,
        cursor,
      },
    },
    async (a) => {
      const { page, perPage } = pageFrom({ limit: a.limit, cursor: a.cursor });
      const filters: ShopFilters = {
        q: a.query,
        country: a.country,
        niche: a.niche,
        theme: a.theme,
        app: a.app,
        revenue_min: a.min_monthly_revenue,
        revenue_max: a.max_monthly_revenue,
        ads_min: a.min_active_ads,
        growth_min: a.min_growth,
        sort: a.sort,
        page,
        per_page: perPage,
      };
      const r = await listShops(ctx.db, filters);
      return ok({
        note: ESTIMATE_NOTE,
        total: r.total,
        shops: r.rows.map((s) => toShop(s, ctx.webOrigin)),
        next_cursor: nextCursor(page, perPage, r.total),
      });
    },
  );

  tool(
    "get_shop",
    {
      title: "Shop-details",
      description:
        "Alles over één webshop: geschatte omzet en bestellingen, thema en apps, samenvatting van ads en e-mails, en groei.",
      inputSchema: { domain },
    },
    async ({ domain: raw }) => {
      const d = tryNormalizeDomain(raw);
      if (!d) return fail("Dat is geen geldig domein.");
      const o = await getShopOverview(ctx.db, d);
      if (!o)
        return fail(
          `${d} staat nog niet in TrendTrack. Gebruik lookup_domain om hem op te laten halen.`,
        );
      const s = o.shop;
      return ok({
        note: ESTIMATE_NOTE,
        ...toShop(s, ctx.webOrigin),
        monthly_orders:
          s.est_monthly_orders_low !== null
            ? {
                low: s.est_monthly_orders_low,
                mid: s.est_monthly_orders,
                high: s.est_monthly_orders_high,
                estimate: true,
              }
            : null,
        estimate_signals: Object.keys((s.est_signals ?? {}) as Record<string, unknown>),
        products: o.productCount,
        ads: {
          active: o.ads.active,
          total: o.ads.total,
          total_eu_reach: o.ads.totalReach,
          spend: spend(o.ads.spendLow, o.ads.spendHigh),
        },
        emails: {
          count: o.emails.count,
          by_type: o.emails.byType,
          last_received_at: o.emails.lastReceivedAt,
        },
        revenue_last_days: o.history.slice(-7).map((h) => ({
          date: h.captured_on,
          daily: money(
            h.est_daily_revenue_low,
            h.est_daily_revenue,
            h.est_daily_revenue_high,
            null,
          ),
        })),
      });
    },
  );

  tool(
    "get_shop_products",
    {
      title: "Producten van een shop",
      description:
        "Producten van een webshop, nieuwste of duurste eerst, met prijzen en kortingen (compare_at_price).",
      inputSchema: { domain, sort: z.enum(["newest", "price"]).default("newest"), limit, cursor },
    },
    async (a) => {
      const d = tryNormalizeDomain(a.domain);
      if (!d) return fail("Dat is geen geldig domein.");
      const shop = await getShopByDomain(ctx.db, d);
      if (!shop) return fail(`${d} staat nog niet in TrendTrack. Gebruik lookup_domain.`);
      const { page, perPage } = pageFrom({ limit: a.limit, cursor: a.cursor });
      const r = await listShopProducts(ctx.db, shop.id, {
        sort: a.sort,
        limit: perPage,
        offset: (page - 1) * perPage,
      });
      return ok({
        total: r.total,
        products: r.rows.map((p) => toProduct(p, d)),
        next_cursor: nextCursor(page, perPage, r.total),
      });
    },
  );

  tool(
    "search_ads",
    {
      title: "Ads zoeken",
      description:
        "Zoekt Meta-ads (Facebook/Instagram) die in de EU liepen, uit de officiële Ad Library. Lang lopende ads (min_days_running ≥ 30) zijn vaak winnaars. Met group_by='shop' krijg je per webshop het aantal ads dat aan de filters voldoet, ideaal voor 'welke shops draaien de meeste ...'.",
      inputSchema: {
        q: z
          .string()
          .max(200)
          .optional()
          .describe(
            'Zoek in de advertentietekst. Websearch-syntax: "gratis verzending", korting OR sale.',
          ),
        country,
        active: z.boolean().optional().describe("true = alleen lopende ads."),
        min_days_running: z.number().int().min(0).max(3650).optional(),
        min_reach: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Minimaal EU-bereik (unieke personen)."),
        language: z
          .string()
          .regex(/^[A-Za-z]{2}$/)
          .transform((s) => s.toLowerCase())
          .optional(),
        niches: z
          .array(z.string().max(100))
          .max(20)
          .optional()
          .describe("Alleen ads van shops in deze niches (zie list_filters)."),
        shop_domain: z.string().max(253).optional(),
        sort: z.enum(["newest", "longest", "reach"]).default("newest"),
        group_by: z.enum(["none", "shop"]).default("none"),
        limit,
        cursor,
      },
    },
    async (a) => {
      const base = {
        q: a.q,
        country: a.country,
        active: a.active,
        min_days: a.min_days_running,
        min_reach: a.min_reach,
        language: a.language,
        niche: a.niches?.join(","),
        domain: a.shop_domain ? (tryNormalizeDomain(a.shop_domain) ?? a.shop_domain) : undefined,
        sort: a.sort,
      };
      if (a.group_by === "shop") {
        // Tel per shop over maximaal 1.000 passende ads.
        const groups = new Map<
          string,
          {
            shop_domain: string;
            shop_name: string | null;
            ads: number;
            total_eu_reach: number;
            longest_days: number;
          }
        >();
        let total = 0;
        for (let page = 1; page <= 10; page++) {
          const r = await listAds(ctx.db, { ...base, page, per_page: 100 });
          total = r.total;
          for (const row of r.rows) {
            const ad = toAd(row);
            const key = ad.shop_domain ?? ad.landing_domain ?? "onbekend";
            const g = groups.get(key) ?? {
              shop_domain: key,
              shop_name: row.shops?.name ?? null,
              ads: 0,
              total_eu_reach: 0,
              longest_days: 0,
            };
            g.ads++;
            g.total_eu_reach += ad.eu_total_reach ?? 0;
            g.longest_days = Math.max(g.longest_days, ad.days_running ?? 0);
            groups.set(key, g);
          }
          if (page * 100 >= r.total) break;
        }
        const shops = [...groups.values()]
          .sort((x, y) => y.ads - x.ads || y.total_eu_reach - x.total_eu_reach)
          .slice(0, a.limit);
        return ok({ matching_ads: total, counted_ads: Math.min(total, 1000), shops });
      }
      const { page, perPage } = pageFrom({ limit: a.limit, cursor: a.cursor });
      const r = await listAds(ctx.db, { ...base, page, per_page: perPage });
      return ok({
        note: ESTIMATE_NOTE,
        total: r.total,
        ads: r.rows.map((ad) => ({ ...toAd(ad), body: clip(ad.body) })),
        next_cursor: nextCursor(page, perPage, r.total),
      });
    },
  );

  tool(
    "get_ad",
    {
      title: "Eén ad",
      description: "Alle details van één ad, inclusief de link naar de Meta Ad Library.",
      inputSchema: { id: z.guid() },
    },
    async ({ id }) => {
      const ad = await getAd(ctx.db, id);
      return ad ? ok({ note: ESTIMATE_NOTE, ...toAd(ad) }) : fail("Ad niet gevonden.");
    },
  );

  tool(
    "search_advertisers",
    {
      title: "Adverteerders zoeken",
      description:
        "Facebook/Instagram-pagina's die adverteren, gesorteerd op aantal actieve ads of totaal EU-bereik.",
      inputSchema: {
        q: z.string().max(200).optional().describe("Naam van de pagina of het domein."),
        country,
        sort: z.enum(["active_ads", "reach"]).default("active_ads"),
        limit,
        cursor,
      },
    },
    async (a) => {
      const { page, perPage } = pageFrom({ limit: a.limit, cursor: a.cursor });
      const r = await listAdvertisers(ctx.db, {
        q: a.q,
        country: a.country,
        sort: a.sort,
        page,
        per_page: perPage,
      });
      return ok({
        note: ESTIMATE_NOTE,
        total: r.total,
        advertisers: r.rows.map(toAdvertiser),
        next_cursor: nextCursor(page, perPage, r.total),
      });
    },
  );

  tool(
    "get_advertiser",
    {
      title: "Eén adverteerder",
      description: "Tellingen, bereik en geschatte spend van één adverteerder.",
      inputSchema: { id: z.guid() },
    },
    async ({ id }) => {
      const a = await getAdvertiser(ctx.db, id);
      return a
        ? ok({ note: ESTIMATE_NOTE, ...toAdvertiser(a) })
        : fail("Adverteerder niet gevonden.");
    },
  );

  tool(
    "search_emails",
    {
      title: "E-mails zoeken",
      description:
        "Echte nieuwsbrieven van webshops: welkomstmails, automatische flows en campagnes. Handig om e-mailstrategie en kortingen van concurrenten te bekijken.",
      inputSchema: {
        shop_domain: z.string().max(253).optional(),
        type: z.enum(["welcome", "flow", "campaign"]).optional(),
        since: date.optional().describe("Vanaf datum (YYYY-MM-DD)."),
        until: date.optional(),
        q: z.string().max(200).optional().describe("Zoek in onderwerp en preheader."),
        limit,
        cursor,
      },
    },
    async (a) => {
      const { page, perPage } = pageFrom({ limit: a.limit, cursor: a.cursor });
      const r = await listEmails(ctx.db, {
        domain: a.shop_domain ? (tryNormalizeDomain(a.shop_domain) ?? a.shop_domain) : undefined,
        type: a.type,
        since: a.since,
        until: a.until,
        q: a.q,
        page,
        per_page: perPage,
      });
      return ok({
        total: r.total,
        emails: r.rows.map((e) => ({
          ...toEmail(e, ctx.webOrigin),
          preview: clip(e.text_preview, 200),
        })),
        next_cursor: nextCursor(page, perPage, r.total),
      });
    },
  );

  tool(
    "lookup_domain",
    {
      title: "Shop laten ophalen",
      description:
        "Zet een webshop die nog niet in TrendTrack staat in de wachtrij. Meestal staat hij er binnen een minuut; vraag hem daarna op met get_shop.",
      inputSchema: { domain },
      readOnly: false,
    },
    async ({ domain: raw }) => {
      const d = tryNormalizeDomain(raw);
      if (!d) return fail("Dat is geen geldig domein.");
      if (await getShopByDomain(ctx.db, d))
        return ok({
          domain: d,
          status: "known",
          hint: "Staat al in TrendTrack; gebruik get_shop.",
        });
      const r = await requestLookup(ctx.db, ctx.workspaceId, ctx.userId, d, "mcp");
      return ok({
        domain: d,
        status: r.status,
        hint: "Wordt opgehaald. Probeer get_shop over ongeveer een minuut.",
      });
    },
  );

  tool(
    "track_brand",
    {
      title: "Merk volgen",
      description:
        "Voegt een webshop toe aan de Brandtracker van de gebruiker. Daarna verschijnen nieuwe ads, gestopte ads, nieuwe producten, prijswijzigingen en e-mails in get_brand_changes.",
      inputSchema: { domain },
      readOnly: false,
    },
    async ({ domain: raw }) => {
      const d = tryNormalizeDomain(raw);
      if (!d) return fail("Dat is geen geldig domein.");
      const shop = await getShopByDomain(ctx.db, d);
      if (!shop) return fail(`${d} staat nog niet in TrendTrack. Gebruik eerst lookup_domain.`);
      const usage = await checkAndRecordUsage(ctx.db, ctx.workspaceId, "tracked_brand");
      const { data: already } = await ctx.db
        .from("tracked_brands")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("shop_id", shop.id)
        .maybeSingle();
      if (already) return ok({ domain: d, tracked: true, hint: "Werd al gevolgd." });
      if (!usage.allowed)
        return fail(
          `Je volgt al het maximum van ${usage.limit} merken in je plan. Upgrade: ${ctx.webOrigin}/app/settings/billing`,
        );
      await trackBrand(ctx.db, ctx.workspaceId, ctx.userId, shop.id);
      return ok({ domain: d, tracked: true, brandtracker: `${ctx.webOrigin}/app/brandtracker` });
    },
  );

  tool(
    "get_brand_changes",
    {
      title: "Veranderingen bij gevolgde merken",
      description:
        "Wat er veranderde bij de shops in de Brandtracker: nieuwe en gestopte ads, nieuwe en verdwenen producten, prijswijzigingen en nieuwe e-mails. Nieuwste eerst.",
      inputSchema: {
        since: date.optional().describe("Vanaf datum (YYYY-MM-DD). Standaard de laatste 7 dagen."),
        types: z
          .array(
            z.enum([
              "new_ad",
              "stopped_ad",
              "new_product",
              "removed_product",
              "price_change",
              "new_email",
            ]),
          )
          .optional(),
        limit,
      },
    },
    async (a) => {
      const tracked = await listTrackedBrands(ctx.db, ctx.workspaceId);
      if (tracked.length === 0)
        return ok({
          tracked: [],
          changes: [],
          hint: "Er worden nog geen merken gevolgd. Gebruik track_brand.",
        });
      const since = a.since ?? new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const events = await listShopEvents(
        ctx.db,
        tracked.map((t) => t.shops.id),
        { since, types: a.types as ShopEventType[] | undefined, limit: a.limit },
      );
      return ok({
        since,
        tracked: tracked.map((t) => t.shops.domain),
        changes: events.map((e) => ({
          type: e.type,
          shop: e.shops.domain,
          at: e.occurred_at,
          ...(e.payload as Record<string, unknown>),
        })),
      });
    },
  );
}
