import { z } from "zod";

/**
 * Filters voor shops, ads en e-mails. Eén definitie voor dashboard (URL-parameters),
 * REST API en MCP-server, zodat ze overal hetzelfde betekenen.
 */

type Raw = Record<string, string | string[] | undefined>;

/** Next.js geeft searchParams als string | string[]; neem de eerste en gooi lege waarden weg. */
export function cleanParams(raw: Raw): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (first !== undefined && first.trim() !== "") out[k] = first.trim();
  }
  return out;
}

const country = z
  .string()
  .regex(/^[A-Za-z]{2}$/)
  .transform((s) => s.toUpperCase());
const num = z.coerce.number().finite();
const page = z.coerce.number().int().min(1).max(10_000).default(1);
const perPage = (def: number) => z.coerce.number().int().min(1).max(100).default(def);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const text = z.string().max(200);

export const ShopFiltersSchema = z.object({
  q: text.optional(),
  country: country.optional(),
  niche: text.optional(),
  theme: text.optional(),
  app: text.optional(),
  revenue_min: num.nonnegative().optional(),
  revenue_max: num.nonnegative().optional(),
  ads_min: num.int().nonnegative().optional(),
  growth_min: num.min(-1).max(1).optional(),
  first_seen_after: date.optional(),
  sort: z.enum(["growth", "revenue", "ads", "newest", "name"]).default("growth"),
  order: z.enum(["asc", "desc"]).optional(),
  page,
  per_page: perPage(25),
});
export type ShopFilters = z.infer<typeof ShopFiltersSchema>;

export const AdFiltersSchema = z.object({
  q: text.optional(),
  country: country.optional(),
  active: bool.optional(),
  min_days: num.int().min(0).max(3650).optional(),
  min_reach: num.int().nonnegative().optional(),
  media_type: z.enum(["image", "video", "carousel", "unknown"]).optional(),
  language: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .transform((s) => s.toLowerCase())
    .optional(),
  domain: text.optional(),
  advertiser_id: z.guid().optional(),
  /** Eén of meer niches (komma-gescheiden), bv. "Kettingen,Oorbellen". */
  niche: text.optional(),
  sort: z.enum(["newest", "longest", "reach"]).default("newest"),
  page,
  per_page: perPage(24),
});
export type AdFilters = z.infer<typeof AdFiltersSchema>;

export const EmailFiltersSchema = z.object({
  q: text.optional(),
  type: z.enum(["welcome", "flow", "campaign"]).optional(),
  domain: text.optional(),
  niche: text.optional(),
  since: date.optional(),
  until: date.optional(),
  page,
  per_page: perPage(24),
});
export type EmailFilters = z.infer<typeof EmailFiltersSchema>;

export const AdvertiserFiltersSchema = z.object({
  q: text.optional(),
  country: country.optional(),
  sort: z.enum(["active_ads", "reach"]).default("active_ads"),
  page,
  per_page: perPage(25),
});
export type AdvertiserFilters = z.infer<typeof AdvertiserFiltersSchema>;

/**
 * Parseert ruwe parameters. Ongeldige waarden vallen weg in plaats van een fout te geven:
 * een kapotte URL in het dashboard moet gewoon de standaardlijst tonen.
 */
export function parseFilters<S extends z.ZodObject>(schema: S, raw: Raw): z.infer<S> {
  const clean = cleanParams(raw);
  const strict = schema.safeParse(clean);
  if (strict.success) return strict.data;
  const bad = new Set(strict.error.issues.map((i) => String(i.path[0])));
  const rest = Object.fromEntries(Object.entries(clean).filter(([k]) => !bad.has(k)));
  return schema.parse(rest);
}

/** Zet filters terug naar een querystring; standaardwaarden en lege velden laten we weg. */
export function toQueryString(
  filters: Record<string, unknown>,
  defaults: Record<string, unknown> = {},
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "" || v === defaults[k]) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Maakt gebruikersinvoer veilig voor PostgREST `ilike`/`or` (geen jokers of scheidingstekens). */
export function escapeLike(input: string): string {
  return input.replace(/[%_,()\\*]/g, " ").trim();
}

/** Label voor de betrouwbaarheid van een schatting (zie docs/estimation.md). */
export function confidenceLevel(
  confidence: number | null | undefined,
): "rough" | "fair" | "strong" | null {
  if (confidence === null || confidence === undefined) return null;
  return confidence < 0.3 ? "rough" : confidence <= 0.6 ? "fair" : "strong";
}
