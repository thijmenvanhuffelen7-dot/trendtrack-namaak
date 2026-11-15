/** De shop blokkeert ons (403/429/430 of anti-bot). We markeren als blocked en omzeilen dit niet. */
export class BlockedError extends Error {
  constructor(
    readonly url: string,
    readonly status: number | null,
    reason = "geblokkeerd",
  ) {
    super(`${reason}: ${url}${status ? ` (HTTP ${status})` : ""}`);
    this.name = "BlockedError";
  }
}

/** robots.txt staat dit pad niet toe voor onze bot. */
export class RobotsDisallowedError extends Error {
  constructor(readonly url: string) {
    super(`robots.txt staat dit niet toe: ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

/** Het domein wijst naar een intern/privé adres of is ongeldig (SSRF-bescherming). */
export class UnsafeTargetError extends Error {
  constructor(
    readonly url: string,
    reason: string,
  ) {
    super(`Onveilig doel ${url}: ${reason}`);
    this.name = "UnsafeTargetError";
  }
}

/**
 * Onbereikbaar. `dns`: het domein bestaat niet (meer). `network`: tijdelijk probleem
 * (timeout, verbinding, 5xx na alle retries) — later opnieuw proberen.
 */
export class UnreachableError extends Error {
  constructor(
    readonly url: string,
    cause?: unknown,
    readonly kind: "dns" | "network" = "network",
  ) {
    super(`Onbereikbaar (${kind}): ${url}`, { cause });
    this.name = "UnreachableError";
  }
}
