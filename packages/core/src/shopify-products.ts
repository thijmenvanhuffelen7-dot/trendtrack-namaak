import { z } from "zod";

const num = z.union([z.string(), z.number()]).transform((v) => Number(v));

const VariantSchema = z.object({
  id: z.number(),
  price: num,
  compare_at_price: num.nullish(),
  available: z.boolean().optional(),
});

const ProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  vendor: z.string().nullish(),
  product_type: z.string().nullish(),
  created_at: z.string().nullish(),
  published_at: z.string().nullish(),
  // Oudere stores geven tags als komma-gescheiden string.
  tags: z.union([z.array(z.string()), z.string()]).nullish(),
  variants: z.array(VariantSchema).default([]),
  images: z.array(z.object({ src: z.string() })).default([]),
});
export type ShopifyProduct = z.infer<typeof ProductSchema>;

export const ProductsPageSchema = z.object({ products: z.array(ProductSchema) });

/** Product zoals we het opslaan (zonder shop_id). */
export interface ProductRecord {
  external_id: string;
  handle: string;
  title: string;
  product_type: string | null;
  vendor: string | null;
  price_min: number | null;
  price_max: number | null;
  compare_at_price: number | null;
  image_url: string | null;
  tags: string[];
  created_at_shop: string | null;
  published_at: string | null;
  available_variants: number;
  total_variants: number;
}

export function parseProductsPage(json: unknown): ShopifyProduct[] {
  return ProductsPageSchema.parse(json).products;
}

export function toProductRecord(p: ShopifyProduct): ProductRecord {
  const prices = p.variants.map((v) => v.price).filter((n) => Number.isFinite(n));
  const compare = p.variants
    .map((v) => v.compare_at_price ?? null)
    .filter((n): n is number => n !== null && Number.isFinite(n) && n > 0);
  const tags = Array.isArray(p.tags)
    ? p.tags
    : (p.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

  return {
    external_id: String(p.id),
    handle: p.handle,
    title: p.title,
    product_type: p.product_type || null,
    vendor: p.vendor || null,
    price_min: prices.length ? Math.min(...prices) : null,
    price_max: prices.length ? Math.max(...prices) : null,
    compare_at_price: compare.length ? Math.max(...compare) : null,
    image_url: p.images[0]?.src ?? null,
    tags,
    created_at_shop: p.created_at ?? null,
    published_at: p.published_at ?? null,
    available_variants: p.variants.filter((v) => v.available !== false).length,
    total_variants: p.variants.length,
  };
}

/** Haalt product-handles in volgorde uit een collectiepagina (HTML). Dubbelen worden weggefilterd. */
export function extractProductHandles(html: string): string[] {
  const seen = new Set<string>();
  const re =
    /href=["'](?:https?:\/\/[^"'/]+)?(?:\/[a-z]{2}(?:-[a-z]{2})?)?(?:\/collections\/[^"'/]+)?\/products\/([a-z0-9][a-z0-9-_%.]*)/gi;
  for (const m of html.matchAll(re)) {
    const handle = decodeURIComponent(m[1]!).toLowerCase();
    if (!seen.has(handle)) seen.add(handle);
  }
  return [...seen];
}
