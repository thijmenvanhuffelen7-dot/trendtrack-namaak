import { createHash } from "node:crypto";
import {
  APP_SIGNATURES,
  BlockedError,
  crawlerIdentity,
  parseProductsPage,
  parseShopifyHomepage,
  PoliteFetcher,
  RobotsDisallowedError,
  toProductRecord,
  tryNormalizeDomain,
  UnreachableError,
  UnsafeTargetError,
  type PoliteFetcherOptions,
  type ProductRecord,
} from "@trendtrack/core";
import type { Db } from "@trendtrack/db";

/**
 * Logica van de gratis tools op de publieke site. Gebruikt dezelfde beleefde fetcher als de crawler
 * (robots.txt, SSRF-bescherming, timeouts) en dezelfde parsers.
 */

/** Limieten per IP-adres per uur. */
export const PUBLIC_LIMITS = { detect: 20, products: 5, ads: 20, estimate: 30 } as const;
export type PublicTool = keyof typeof PUBLIC_LIMITS;

/** IP uit de proxy-headers (Vercel zet x-forwarded-for). Gehasht met een geheim zout. */
export function ipHash(headers: Headers): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "onbekend";
  return createHash("sha256")
    .update(`${process.env.RATE_LIMIT_SALT ?? "lokaal"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

export async function hitPublicLimit(db: Db, headers: Headers, tool: PublicTool) {
  const { data, error } = await db.rpc("public_rate_hit", {
    p_ip_hash: ipHash(headers),
    p_tool: tool,
    p_per_hour: PUBLIC_LIMITS[tool],
  });
  if (error) throw error;
  const r = data[0]!;
  return { allowed: r.allowed, resetAt: r.reset_at };
}

export class ToolError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Overschrijfbaar in tests (nep-netwerk en nep-DNS). */
export type FetcherOverrides = Partial<
  Pick<PoliteFetcherOptions, "fetch" | "resolveHost" | "sleep">
>;

function fetcher(overrides: FetcherOverrides = {}) {
  const { userAgent, robotsToken } = crawlerIdentity();
  return new PoliteFetcher({
    userAgent,
    robotsToken,
    timeoutMs: 8_000,
    maxRetries: 1,
    minIntervalMs: 500,
    ...overrides,
  });
}

function explain(err: unknown, domain: string): ToolError {
  if (err instanceof BlockedError || err instanceof RobotsDisallowedError)
    return new ToolError(422, `${domain} staat niet toe dat we de winkel bekijken.`);
  if (err instanceof UnsafeTargetError) return new ToolError(400, "Dat is geen publieke webshop.");
  if (err instanceof UnreachableError)
    return new ToolError(422, `${domain} is niet bereikbaar. Klopt het adres?`);
  return new ToolError(500, "Er ging iets mis. Probeer het later opnieuw.");
}

export function parseDomain(input: unknown): string {
  const d = typeof input === "string" ? tryNormalizeDomain(input) : null;
  if (!d) throw new ToolError(400, "Vul een geldig domein in, bijvoorbeeld zilverzand.nl.");
  return d;
}

export interface DetectResult {
  domain: string;
  isShopify: boolean;
  name: string | null;
  theme: string | null;
  country: string | null;
  currency: string | null;
  apps: { id: string; name: string; category: string }[];
}

/** Thema- en app-detector: één request naar de homepage. */
export async function detectPublic(
  domain: string,
  overrides?: FetcherOverrides,
): Promise<DetectResult> {
  try {
    const { response } = await fetcher(overrides).get(`https://${domain}/`, {
      accept: "text/html",
    });
    if (!response.ok) throw new UnreachableError(domain);
    const info = parseShopifyHomepage(await response.text());
    const byId = new Map(APP_SIGNATURES.map((a) => [a.id, a]));
    return {
      domain,
      isShopify: info.isShopify,
      name: info.name,
      theme: info.themeName,
      country: info.country,
      currency: info.currency,
      apps: info.apps.map((id) => ({
        id,
        name: byId.get(id)?.name ?? id,
        category: byId.get(id)?.category ?? "other",
      })),
    };
  } catch (err) {
    throw explain(err, domain);
  }
}

/** Productexport: alleen de eerste pagina van /products.json (max 250 producten). */
export async function exportProductsPublic(
  domain: string,
  overrides?: FetcherOverrides,
): Promise<ProductRecord[]> {
  try {
    const json = await fetcher(overrides).getJson(
      `https://${domain}/products.json?limit=250&page=1`,
    );
    return parseProductsPage(json).map(toProductRecord);
  } catch (err) {
    if (err instanceof UnreachableError)
      throw new ToolError(
        422,
        `${domain} heeft geen openbare productlijst (geen Shopify-store of afgeschermd).`,
      );
    throw explain(err, domain);
  }
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : String(v);
  // Spreadsheet-injectie voorkomen: cellen die met = + - @ beginnen krijgen een apostrof.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function productsToCsv(domain: string, rows: ProductRecord[]): string {
  const header = [
    "titel",
    "handle",
    "url",
    "type",
    "merk",
    "prijs_vanaf",
    "prijs_tot",
    "van_prijs",
    "varianten",
    "op_voorraad",
    "tags",
    "gepubliceerd",
  ];
  const lines = rows.map((r) =>
    [
      r.title,
      r.handle,
      `https://${domain}/products/${r.handle}`,
      r.product_type,
      r.vendor,
      r.price_min,
      r.price_max,
      r.compare_at_price,
      r.total_variants,
      r.available_variants,
      r.tags,
      r.published_at,
    ]
      .map(csvCell)
      .join(","),
  );
  // BOM zodat Excel UTF-8 (é, ë) goed toont.
  return "﻿" + [header.join(","), ...lines].join("\n") + "\n";
}
