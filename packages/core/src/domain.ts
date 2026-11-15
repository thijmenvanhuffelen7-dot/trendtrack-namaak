/**
 * Normaliseert een URL of domein naar een kale hostname zonder "www.".
 * Gooit een fout als de invoer geen geldig publiek domein is.
 *
 *   normalizeDomain("https://www.Shop.nl/products/x?y=1") === "shop.nl"
 */
export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) throw new Error("Leeg domein");

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;

  let host: string;
  try {
    host = new URL(withScheme).hostname;
  } catch {
    throw new Error(`Ongeldig domein: ${input}`);
  }

  host = host.replace(/^www\./, "").replace(/\.$/, "");

  if (!isValidHostname(host)) throw new Error(`Ongeldig domein: ${input}`);
  return host;
}

/** Zelfde als normalizeDomain, maar geeft null terug in plaats van te gooien. */
export function tryNormalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    return normalizeDomain(input);
  } catch {
    return null;
  }
}

function isValidHostname(host: string): boolean {
  if (host.length > 253 || !host.includes(".")) return false;
  // Geen IP-adressen: we crawlen alleen domeinnamen.
  if (/^\d+(\.\d+){3}$/.test(host) || host.includes(":")) return false;
  const labels = host.split(".");
  const tld = labels[labels.length - 1] ?? "";
  if (!/^[a-z]{2,63}$/.test(tld) && !/^xn--[a-z0-9-]+$/.test(tld)) return false;
  return labels.every((l) => /^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(l));
}
