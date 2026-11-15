import { z } from "zod";
import { estimateAdSpend } from "./cpm";
import { tryNormalizeDomain } from "./domain";

/**
 * Client voor de officiële Meta Ad Library API (Graph API `ads_archive`).
 * Alleen de officiële API: geen scraping van de Ad Library-website.
 * Docs: https://www.facebook.com/ads/library/api
 */

export const META_AD_FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_captions",
  "ad_creative_link_descriptions",
  "ad_snapshot_url",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "publisher_platforms",
  "languages",
  "eu_total_reach",
  "target_ages",
  "target_gender",
  "target_locations",
  "beneficiary_payers",
] as const;

const strArray = z.array(z.string()).nullish();

export const MetaAdSchema = z
  .object({
    id: z.string(),
    page_id: z.string(),
    page_name: z.string().nullish(),
    ad_creative_bodies: strArray,
    ad_creative_link_titles: strArray,
    ad_creative_link_captions: strArray,
    ad_creative_link_descriptions: strArray,
    ad_snapshot_url: z.string().nullish(),
    ad_delivery_start_time: z.string().nullish(),
    ad_delivery_stop_time: z.string().nullish(),
    publisher_platforms: strArray,
    languages: strArray,
    eu_total_reach: z.coerce.number().nullish(),
    target_ages: strArray,
    target_gender: z.string().nullish(),
    target_locations: z
      .array(
        z
          .object({ name: z.string(), type: z.string().nullish(), excluded: z.boolean().nullish() })
          .loose(),
      )
      .nullish(),
    beneficiary_payers: z
      .array(z.object({ payer: z.string().nullish(), beneficiary: z.string().nullish() }).loose())
      .nullish(),
  })
  .loose();
export type MetaAd = z.infer<typeof MetaAdSchema>;

const PageSchema = z.object({
  data: z.array(MetaAdSchema),
  paging: z
    .object({
      cursors: z.object({ after: z.string().optional() }).optional(),
      next: z.string().optional(),
    })
    .optional(),
});

const ErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly subcode: number | null,
    readonly status: number,
  ) {
    super(`Meta API: ${message} (code ${code ?? "?"}, HTTP ${status})`);
    this.name = "MetaApiError";
  }
}

/** Token ongeldig of verlopen (code 190). Niet opnieuw proberen: nieuwe token nodig (zie runbook). */
export class MetaTokenError extends MetaApiError {
  override name = "MetaTokenError";
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80004]);

export interface AdsArchiveQuery {
  countries: string[];
  searchPageIds?: string[];
  searchTerms?: string;
  activeStatus?: "ALL" | "ACTIVE" | "INACTIVE";
  /** Max aantal pagina's (veiligheid tegen eindeloos pagineren). */
  maxPages?: number;
  pageSize?: number;
}

export interface MetaClientOptions {
  accessToken: string;
  apiVersion?: string;
  fetch?: (url: string) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  /** Boven dit gebruikspercentage (uit de usage-headers) wachten we eerst. */
  usageThreshold?: number;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
}

export class MetaAdLibraryClient {
  private readonly o: Required<MetaClientOptions>;

  constructor(options: MetaClientOptions) {
    if (!options.accessToken) throw new Error("META_ACCESS_TOKEN ontbreekt");
    this.o = {
      apiVersion: "v23.0",
      fetch: (url) => fetch(url),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      maxRetries: 4,
      usageThreshold: 90,
      log: () => undefined,
      ...options,
    };
  }

  /** Haalt alle pagina's op voor een zoekopdracht. Async generator: per pagina een array ads. */
  async *search(q: AdsArchiveQuery): AsyncGenerator<MetaAd[]> {
    if (!q.searchPageIds?.length && !q.searchTerms)
      throw new Error("searchPageIds of searchTerms is verplicht");
    const params = new URLSearchParams({
      ad_type: "ALL",
      ad_active_status: q.activeStatus ?? "ALL",
      ad_reached_countries: JSON.stringify(q.countries),
      fields: META_AD_FIELDS.join(","),
      limit: String(q.pageSize ?? 200),
    });
    if (q.searchPageIds?.length)
      params.set("search_page_ids", JSON.stringify(q.searchPageIds.slice(0, 10)));
    if (q.searchTerms) params.set("search_terms", q.searchTerms);

    let after: string | undefined;
    for (let page = 0; page < (q.maxPages ?? 50); page++) {
      if (after) params.set("after", after);
      const body = await this.request(params);
      const parsed = PageSchema.parse(body);
      if (parsed.data.length) yield parsed.data;
      after = parsed.paging?.cursors?.after;
      if (!parsed.paging?.next || !after) return;
    }
  }

  private async request(params: URLSearchParams): Promise<unknown> {
    // Token pas hier toevoegen en nooit loggen.
    const url = `https://graph.facebook.com/${this.o.apiVersion}/ads_archive?${params}&access_token=${encodeURIComponent(this.o.accessToken)}`;

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.o.fetch(url);
      } catch (err) {
        if (attempt >= this.o.maxRetries)
          throw new MetaApiError(`netwerkfout: ${(err as Error).message}`, null, null, 0);
        await this.o.sleep(backoff(attempt));
        continue;
      }

      const usage = readUsage(res.headers);
      const body: unknown = await res.json().catch(() => null);

      if (res.ok) {
        if (usage.maxPercent >= this.o.usageThreshold) {
          const wait = Math.max(60_000, usage.regainMinutes * 60_000);
          this.o.log("Meta-gebruik hoog, even wachten", {
            percent: usage.maxPercent,
            waitMs: wait,
          });
          await this.o.sleep(wait);
        }
        return body;
      }

      const err = ErrorSchema.safeParse(body);
      const code = err.success ? err.data.error.code : null;
      const subcode = err.success ? (err.data.error.error_subcode ?? null) : null;
      const message = err.success ? err.data.error.message : `HTTP ${res.status}`;

      if (code === 190) throw new MetaTokenError(message, code, subcode, res.status);
      const retryable =
        (code !== null && RATE_LIMIT_CODES.has(code)) || res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= this.o.maxRetries)
        throw new MetaApiError(message, code, subcode, res.status);

      const wait = usage.regainMinutes > 0 ? usage.regainMinutes * 60_000 : backoff(attempt);
      this.o.log("Meta rate limit / fout, opnieuw proberen", { code, attempt, waitMs: wait });
      await this.o.sleep(wait);
    }
  }
}

/** Leest `x-app-usage` en `x-business-use-case-usage` (percentages 0-100). */
export function readUsage(headers: Headers): { maxPercent: number; regainMinutes: number } {
  let maxPercent = 0;
  let regainMinutes = 0;
  const take = (o: Record<string, unknown>) => {
    for (const k of ["call_count", "total_cputime", "total_time"]) {
      const v = Number(o[k]);
      if (Number.isFinite(v)) maxPercent = Math.max(maxPercent, v);
    }
    const r = Number(o.estimated_time_to_regain_access);
    if (Number.isFinite(r)) regainMinutes = Math.max(regainMinutes, r);
  };
  try {
    const app = headers.get("x-app-usage");
    if (app) take(JSON.parse(app) as Record<string, unknown>);
    const buc = headers.get("x-business-use-case-usage");
    if (buc) {
      for (const entries of Object.values(
        JSON.parse(buc) as Record<string, Record<string, unknown>[]>,
      )) {
        for (const e of entries) take(e);
      }
    }
  } catch {
    // kapotte header: negeren
  }
  return { maxPercent, regainMinutes };
}

function backoff(attempt: number) {
  return Math.min(5 * 60_000, 2_000 * 2 ** attempt);
}

// ---------------------------------------------------------------------------
// Mapping naar onze ads-tabel
// ---------------------------------------------------------------------------

/** Domeinen die nooit de webshop zelf zijn. */
const NON_SHOP_DOMAINS = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "instagram.com",
  "messenger.com",
  "whatsapp.com",
  "wa.me",
  "bit.ly",
  "linktr.ee",
  "tinyurl.com",
  "goo.gl",
  "google.com",
  "youtube.com",
  "tiktok.com",
  "apps.apple.com",
  "play.google.com",
  "shopify.com",
  "myshopify.com",
];

function isShopDomain(d: string) {
  return !NON_SHOP_DOMAINS.some((n) => d === n || d.endsWith(`.${n}`));
}

/**
 * Bepaalt het landingsdomein. De API geeft geen landings-URL; de link caption is het
 * getoonde domein (bv. "ZILVERZAND.NL"). Valt terug op een domein in de tekst.
 */
export function extractLandingDomain(
  ad: Pick<MetaAd, "ad_creative_link_captions" | "ad_creative_bodies">,
): string | null {
  for (const caption of ad.ad_creative_link_captions ?? []) {
    const d = tryNormalizeDomain(caption.split(/\s/)[0]);
    if (d && isShopDomain(d)) return d;
  }
  const re =
    /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:nl|be|com|eu|shop|store|de|fr)(?:\/[^\s]*)?)/gi;
  for (const body of ad.ad_creative_bodies ?? []) {
    for (const m of body.matchAll(re)) {
      const d = tryNormalizeDomain(m[1]);
      if (d && isShopDomain(d)) return d;
    }
  }
  return null;
}

export interface MappedAd {
  external_id: string;
  page_id: string;
  page_name: string | null;
  body: string | null;
  title: string | null;
  cta: null;
  landing_url: string | null;
  landing_domain: string | null;
  media_type: "unknown";
  snapshot_url: string;
  started_at: string | null;
  ended_at: string | null;
  is_active: boolean;
  eu_total_reach: number | null;
  est_spend_low: number | null;
  est_spend_high: number | null;
  countries: string[];
  languages: string[];
  raw: Record<string, unknown>;
}

/** Zet een API-ad om naar een rij voor `ads`. `countries` = landen waarin we hem vonden. */
export function mapMetaAd(ad: MetaAd, countries: string[], now: Date = new Date()): MappedAd {
  const domain = extractLandingDomain(ad);
  const stop = ad.ad_delivery_stop_time ? Date.parse(ad.ad_delivery_stop_time) : NaN;
  const ended = Number.isFinite(stop);
  const spend = estimateAdSpend(ad.eu_total_reach, countries);
  // ad_snapshot_url bevat ons access token: nooit opslaan. De publieke Ad Library-link wel.
  const { ad_snapshot_url: _snapshot, ...rest } = ad;

  return {
    external_id: ad.id,
    page_id: ad.page_id,
    page_name: ad.page_name ?? null,
    body: ad.ad_creative_bodies?.[0] ?? null,
    title: ad.ad_creative_link_titles?.[0] ?? null,
    cta: null, // de API geeft het CTA-type niet terug
    landing_url: domain ? `https://${domain}/` : null,
    landing_domain: domain,
    media_type: "unknown",
    snapshot_url: `https://www.facebook.com/ads/library/?id=${encodeURIComponent(ad.id)}`,
    started_at: ad.ad_delivery_start_time
      ? new Date(ad.ad_delivery_start_time).toISOString()
      : null,
    ended_at: ended ? new Date(stop).toISOString() : null,
    // Een stopdatum in de toekomst = gepland einde, nog actief.
    is_active: !ended || stop > now.getTime(),
    eu_total_reach: ad.eu_total_reach ?? null,
    est_spend_low: spend?.low ?? null,
    est_spend_high: spend?.high ?? null,
    countries: [...new Set(countries.map((c) => c.toUpperCase()))].sort(),
    languages: ad.languages ?? [],
    raw: rest,
  };
}
