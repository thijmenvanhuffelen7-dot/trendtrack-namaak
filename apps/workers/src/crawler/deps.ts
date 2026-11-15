import type { PoliteFetcher } from "../http/polite-fetcher";
import type { ShopRepo } from "../repo/shop-repo";

export interface CrawlerDeps {
  fetcher: PoliteFetcher;
  repo: ShopRepo;
  now?: () => Date;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
}

export const nowOf = (deps: CrawlerDeps) => (deps.now ?? (() => new Date()))();
export const logOf = (deps: CrawlerDeps) => deps.log ?? (() => undefined);
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
