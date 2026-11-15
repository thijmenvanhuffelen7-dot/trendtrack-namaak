import { randomBytes } from "node:crypto";

/**
 * Seed-adres per shop: <slug>-<6 tekens>@<inboxdomein>. De random suffix maakt het adres
 * onraadbaar, zodat niemand ons met nepmail kan vervuilen door adressen te gokken.
 */
export function generateSeedAddress(
  shopNameOrDomain: string,
  inboxDomain: string,
  random = randomSuffix,
): string {
  const slug =
    shopNameOrDomain
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\.(nl|be|com|eu|shop|store|de|fr)$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "shop";
  return `${slug}-${random()}@${inboxDomain.toLowerCase()}`;
}

function randomSuffix(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // geen 0/o/1/l
  return [...randomBytes(6)].map((b) => alphabet[b % alphabet.length]).join("");
}

/** Haalt kale adressen uit headers als `"Naam" <a@b.nl>, c@d.nl`. Lowercase, uniek. */
export function extractAddresses(header: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(header) ? header : header ? [header] : [];
  const out = new Set<string>();
  for (const p of parts) {
    for (const m of p.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi))
      out.add(m[0].toLowerCase());
  }
  return [...out];
}
