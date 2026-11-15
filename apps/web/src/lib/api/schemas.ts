import {
  AdFiltersSchema,
  AdvertiserFiltersSchema,
  EmailFiltersSchema,
  ShopFiltersSchema,
} from "@trendtrack/core";
import { z } from "zod";

/**
 * Schema's van de publieke API (v1). Ze valideren de invoer, typeren de uitvoer en zijn de bron
 * van de OpenAPI-spec (/api/v1/openapi.json). Wijzig je hier iets, dan verandert de spec mee.
 */

// --- Invoer ---------------------------------------------------------------------------------------

const pagination = {
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Aantal resultaten per pagina (1-100)."),
  cursor: z.string().max(200).optional().describe("De `next_cursor` uit het vorige antwoord."),
};
const noPage = { page: true, per_page: true } as const;

export const ShopsQuery = ShopFiltersSchema.omit(noPage).extend(pagination);
export const AdsQuery = AdFiltersSchema.omit(noPage).extend(pagination);
export const AdvertisersQuery = AdvertiserFiltersSchema.omit(noPage).extend(pagination);
export const EmailsQuery = EmailFiltersSchema.omit(noPage).extend(pagination);
export const ProductsQuery = z.object({
  sort: z.enum(["newest", "price"]).default("newest"),
  ...pagination,
});
export const LookupBody = z.object({
  domain: z.string().min(3).max(253).describe("Domein of URL van de webshop, bv. `zilverzand.nl`."),
});

// --- Uitvoer --------------------------------------------------------------------------------------

/** Elk geschat getal is een bandbreedte met `estimate: true`. Nooit één hard getal. */
export const MoneyEstimate = z
  .object({
    low: z.number(),
    mid: z.number().nullable(),
    high: z.number(),
    confidence: z.number().min(0).max(1).nullable(),
    currency: z.literal("EUR"),
    estimate: z.literal(true),
  })
  .describe("Schatting als bandbreedte. Zie /schattingen voor hoe we schatten.");

export const CountEstimate = z.object({
  low: z.number(),
  mid: z.number().nullable(),
  high: z.number(),
  estimate: z.literal(true),
});
export const SpendEstimate = z
  .object({
    low: z.number(),
    high: z.number(),
    currency: z.literal("EUR"),
    estimate: z.literal(true),
  })
  .describe("Geschatte ad spend: EU-bereik × frequentie × CPM. Meta geeft geen spend vrij.");

export const Shop = z.object({
  domain: z.string(),
  name: z.string().nullable(),
  country: z.string().nullable(),
  currency: z.string().nullable(),
  niche: z.string().nullable(),
  theme: z.string().nullable(),
  apps: z.array(z.string()),
  status: z.enum(["active", "blocked", "dead"]),
  first_seen_at: z.string(),
  active_ads: z.number().int(),
  growth_score: z
    .number()
    .nullable()
    .describe("−1 (krimp) tot 1 (sterke groei): laatste 7 dagen t.o.v. de 28 daarvoor."),
  monthly_revenue: MoneyEstimate.nullable(),
  url: z.string().describe("Link naar de shop in het dashboard."),
});

export const ShopDetail = Shop.extend({
  platform: z.string().nullable(),
  last_crawled_at: z.string().nullable(),
  monthly_orders: CountEstimate.nullable(),
  estimate_signals: z
    .array(z.string())
    .describe("Welke signalen de schatting droegen: ads, sellouts, reviews."),
  products: z.object({ count: z.number().int() }),
  ads: z.object({
    active: z.number().int(),
    total: z.number().int(),
    total_eu_reach: z.number(),
    spend: SpendEstimate.nullable(),
  }),
  emails: z.object({
    count: z.number().int(),
    by_type: z.object({
      welcome: z.number().int(),
      flow: z.number().int(),
      campaign: z.number().int(),
    }),
    last_received_at: z.string().nullable(),
  }),
  history: z
    .array(
      z.object({
        date: z.string(),
        daily_revenue: MoneyEstimate.nullable(),
        active_ads: z.number().int().nullable(),
      }),
    )
    .describe("Dagelijkse snapshots van de laatste 30 dagen."),
});

export const Product = z.object({
  id: z.string(),
  external_id: z.string(),
  title: z.string(),
  handle: z.string().nullable(),
  product_type: z.string().nullable(),
  vendor: z.string().nullable(),
  price_min: z.number().nullable(),
  price_max: z.number().nullable(),
  compare_at_price: z.number().nullable(),
  image_url: z.string().nullable(),
  published_at: z.string().nullable(),
  first_seen_at: z.string(),
  url: z.string().nullable(),
});

export const Ad = z.object({
  id: z.string(),
  platform: z.enum(["meta", "tiktok", "google"]),
  external_id: z.string(),
  advertiser: z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    page_id: z.string().nullable(),
  }),
  shop_domain: z.string().nullable(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  landing_url: z.string().nullable(),
  landing_domain: z.string().nullable(),
  media_type: z.string().nullable(),
  library_url: z.string().nullable().describe("De ad in de officiële Meta Ad Library."),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  is_active: z.boolean(),
  days_running: z.number().int().nullable(),
  eu_total_reach: z.number().nullable(),
  spend: SpendEstimate.nullable(),
  countries: z.array(z.string()),
  languages: z.array(z.string()),
});

export const Advertiser = z.object({
  id: z.string(),
  platform: z.string(),
  page_id: z.string(),
  name: z.string().nullable(),
  country: z.string().nullable(),
  shop_domain: z.string().nullable(),
  active_ads: z.number().int(),
  total_ads: z.number().int(),
  total_eu_reach: z.number(),
  spend: SpendEstimate.nullable(),
  last_ad_started_at: z.string().nullable(),
});

export const Email = z.object({
  id: z.string(),
  shop_domain: z.string(),
  shop_name: z.string().nullable(),
  from: z.string(),
  subject: z.string().nullable(),
  preheader: z.string().nullable(),
  preview: z.string().nullable(),
  type: z.enum(["welcome", "flow", "campaign"]),
  flow_step: z.number().int().nullable(),
  received_at: z.string(),
  url: z.string(),
});

export const Lookup = z.object({
  domain: z.string(),
  status: z
    .enum(["known", "queued", "processing"])
    .describe("`known`: de shop staat al in de database. Anders wordt hij nu opgehaald."),
  shop_url: z.string().describe("Vraag deze URL over een minuut op voor het resultaat."),
});

export const ListEnvelope = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), total: z.number().int(), next_cursor: z.string().nullable() });

export const ErrorBody = z.object({
  error: z.object({
    code: z.enum([
      "bad_request",
      "unauthorized",
      "payment_required",
      "not_found",
      "rate_limited",
      "internal",
    ]),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
