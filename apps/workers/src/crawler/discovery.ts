import { readFile } from "node:fs/promises";
import { tryNormalizeDomain } from "@trendtrack/core";
import { JOBS, PRIORITY, type DomainSource } from "../jobs";
import type { ShopRepo } from "../repo/shop-repo";

/** Het stukje van pg-boss dat we nodig hebben om jobs te plaatsen. */
export interface JobQueue {
  send(
    name: string,
    data: object,
    options?: { singletonKey?: string; priority?: number; retryLimit?: number },
  ): Promise<string | null>;
}

/** Leest een seedlijst: één domein per regel, # voor commentaar. Ongeldige regels vallen weg. */
export function parseSeedList(text: string): string[] {
  const out = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const d = tryNormalizeDomain(line.replace(/#.*$/, ""));
    if (d) out.add(d);
  }
  return [...out];
}

/** Zet domeinen in de wachtrij voor shop.detect. Dubbelen in de wachtrij worden door pg-boss genegeerd. */
export async function enqueueDomains(
  queue: JobQueue,
  domains: string[],
  source: DomainSource,
): Promise<number> {
  let queued = 0;
  for (const raw of domains) {
    const domain = tryNormalizeDomain(raw);
    if (!domain) continue;
    const id = await queue.send(
      JOBS.shopDetect,
      { domain },
      { singletonKey: domain, priority: PRIORITY[source], retryLimit: 2 },
    );
    if (id) queued++;
  }
  return queued;
}

/** Een gebruiker zoekt een domein op dat we nog niet kennen (web, API, MCP). Hoogste prioriteit. */
export async function requestLookup(queue: JobQueue, domain: string): Promise<boolean> {
  return (await enqueueDomains(queue, [domain], "user")) > 0;
}

export interface DiscoveryDeps {
  repo: ShopRepo;
  queue: JobQueue;
  seedFilePath?: string;
}

/** Vindt nieuwe domeinen via ads-landingsdomeinen en de seedlijst. */
export async function runDiscovery(deps: DiscoveryDeps, limit = 500) {
  const fromAds = await deps.repo.unknownAdDomains(limit);
  let fromSeed: string[] = [];
  if (deps.seedFilePath) {
    const all = parseSeedList(await readFile(deps.seedFilePath, "utf8"));
    const existing = await deps.repo.existingDomains(all);
    fromSeed = all.filter((d) => !existing.has(d)).slice(0, limit);
  }
  return {
    ads: await enqueueDomains(deps.queue, fromAds, "ads"),
    seed: await enqueueDomains(deps.queue, fromSeed, "seed"),
  };
}
