import { z } from "zod";
import { detectApps } from "./app-signatures";

export interface ShopifyPageInfo {
  isShopify: boolean;
  name: string | null;
  currency: string | null;
  country: string | null;
  locale: string | null;
  themeName: string | null;
  myshopifyDomain: string | null;
  apps: string[];
}

const ThemeSchema = z.object({
  name: z.string().optional(),
  schema_name: z.string().nullish(),
});

/** Parseert de homepage-HTML van een (mogelijke) Shopify-store. Puur, geen netwerk. */
export function parseShopifyHomepage(html: string): ShopifyPageInfo {
  const isShopify =
    /Shopify\.(theme|shop)\s*=/.test(html) ||
    /cdn\.shopify\.com/i.test(html) ||
    /\/cdn\/shop\//i.test(html) ||
    /shopify-checkout-api-token/i.test(html) ||
    /<meta[^>]+name=["']shopify-/i.test(html);

  return {
    isShopify,
    name: extractName(html),
    currency: upper(
      matchJsonString(html, /Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Za-z]{3})"/),
    ),
    country: upper(matchJsonString(html, /Shopify\.country\s*=\s*"([A-Za-z]{2})"/)),
    locale:
      matchJsonString(html, /Shopify\.locale\s*=\s*"([A-Za-z-]{2,10})"/)?.toLowerCase() ?? null,
    themeName: extractThemeName(html),
    myshopifyDomain: matchJsonString(html, /Shopify\.shop\s*=\s*"([a-z0-9-]+\.myshopify\.com)"/i),
    apps: detectApps(html),
  };
}

function extractThemeName(html: string): string | null {
  const m = html.match(/Shopify\.theme\s*=\s*(\{[^;\n]*\})\s*;?/);
  if (!m?.[1]) return null;
  try {
    const theme = ThemeSchema.parse(JSON.parse(m[1]));
    // schema_name = het echte thema (bv. "Dawn"); name = wat de winkel ervan maakte.
    return theme.schema_name ?? theme.name ?? null;
  } catch {
    return null;
  }
}

function extractName(html: string): string | null {
  const og =
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  if (og?.[1]) return decodeEntities(og[1].trim());
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  if (!title) return null;
  // "Home | Merknaam" of "Merknaam – Slogan": neem het meest waarschijnlijke deel.
  const parts = decodeEntities(title)
    .split(/\s[|–—-]\s/)
    .map((p) => p.trim())
    .filter(Boolean);
  const nonGeneric = parts.filter((p) => !/^(home|homepage|welkom|welcome)$/i.test(p));
  return nonGeneric[0] ?? parts[0] ?? null;
}

function matchJsonString(html: string, re: RegExp): string | null {
  return html.match(re)?.[1] ?? null;
}

function upper(v: string | null): string | null {
  return v ? v.toUpperCase() : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Shopify /meta.json: publiek endpoint met basisinfo over de winkel. */
export const ShopifyMetaSchema = z.object({
  name: z.string().nullish(),
  country: z.string().nullish(),
  currency: z.string().nullish(),
  myshopify_domain: z.string().nullish(),
  published_products_count: z.number().nullish(),
});
export type ShopifyMeta = z.infer<typeof ShopifyMetaSchema>;
