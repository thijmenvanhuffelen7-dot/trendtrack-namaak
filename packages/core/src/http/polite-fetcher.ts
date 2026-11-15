import { lookup } from "node:dns/promises";
import { tryNormalizeDomain } from "../domain";
import { parseRobots, type RobotsRules } from "../robots";
import { BlockedError, RobotsDisallowedError, UnreachableError, UnsafeTargetError } from "./errors";
import { isPrivateIp } from "./ip-guard";

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export type ResolveHost = (host: string) => Promise<string[]>;

export interface FetchResult {
  response: Response;
  /** URL na redirects. */
  url: string;
}

export interface PoliteFetcherOptions {
  userAgent: string;
  /** Token waarop we matchen in robots.txt, bv. "TrendTrackBot". */
  robotsToken: string;
  minIntervalMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
  maxRedirects?: number;
  /** Domein dat altijd moet resolven; bepaalt of een DNS-fout echt "bestaat niet" betekent. */
  dnsCanaryHost?: string;
  fetch?: FetchLike;
  resolveHost?: ResolveHost;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultResolve: ResolveHost = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((r) => r.address);

const RETRY_STATUSES = new Set([500, 502, 503, 504]);
const BLOCK_STATUSES = new Set([401, 403, 429, 430]);

/**
 * HTTP-client voor crawlers:
 * - max 1 request per `minIntervalMs` per domein (requests per domein worden in serie gezet)
 * - respecteert robots.txt (en crawl-delay als die strenger is)
 * - timeouts, retries met exponentiële backoff, Retry-After
 * - SSRF-bescherming: geen IP-adressen, localhost of hosts die naar privé-IP's resolven,
 *   ook niet na redirects
 * - 401/403/429/430 die blijven terugkomen => BlockedError (niet omzeilen)
 */
export class PoliteFetcher {
  private readonly opts: Required<PoliteFetcherOptions>;
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly nextAllowedAt = new Map<string, number>();
  private readonly robots = new Map<string, Promise<RobotsRules>>();

  constructor(options: PoliteFetcherOptions) {
    this.opts = {
      minIntervalMs: 1000,
      timeoutMs: 15_000,
      maxRetries: 3,
      maxRedirects: 5,
      dnsCanaryHost: "shopify.com",
      fetch: (url, init) => fetch(url, init),
      resolveHost: defaultResolve,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
      ...options,
    };
  }

  /** GET met alle beleefdheidsregels. Geeft ook 4xx-responses terug (bv. 404). */
  async get(url: string, { accept = "*/*" }: { accept?: string } = {}): Promise<FetchResult> {
    const target = new URL(url);
    await this.assertSafe(target);
    const rules = await this.getRobots(target);
    if (!rules.isAllowed(target.pathname + target.search)) throw new RobotsDisallowedError(url);
    return this.request(target, accept, rules.crawlDelaySeconds);
  }

  async getJson(url: string): Promise<unknown> {
    const { response: res } = await this.get(url, { accept: "application/json" });
    if (!res.ok) throw new UnreachableError(url, new Error(`HTTP ${res.status}`));
    return res.json();
  }

  /** Mag deze URL volgens robots.txt? (Doet zelf geen request naar de URL.) */
  async isAllowed(url: string): Promise<boolean> {
    const target = new URL(url);
    await this.assertSafe(target);
    const rules = await this.getRobots(target);
    return rules.isAllowed(target.pathname + target.search);
  }

  private getRobots(target: URL): Promise<RobotsRules> {
    const key = target.host;
    let p = this.robots.get(key);
    if (!p) {
      p = this.request(new URL("/robots.txt", target), "text/plain", null)
        .then(async ({ response: res }) => {
          // 4xx => geen robots.txt => alles toegestaan (RFC 9309). 5xx => voorzichtig: niets.
          if (res.status >= 500)
            return parseRobots("User-agent: *\nDisallow: /", this.opts.robotsToken);
          if (!res.ok) return parseRobots("", this.opts.robotsToken);
          return parseRobots(await res.text(), this.opts.robotsToken);
        })
        .catch((err: unknown) => {
          this.robots.delete(key);
          throw err;
        });
      this.robots.set(key, p);
    }
    return p;
  }

  /** Werkt DNS überhaupt? Zo niet, dan is "domein bestaat niet" niet te vertrouwen. */
  private async dnsWorks(): Promise<boolean> {
    try {
      return (await this.opts.resolveHost(this.opts.dnsCanaryHost)).length > 0;
    } catch {
      return false;
    }
  }

  private async assertSafe(target: URL): Promise<void> {
    if (target.protocol !== "https:" && target.protocol !== "http:") {
      throw new UnsafeTargetError(target.href, "alleen http(s)");
    }
    if (target.port && target.port !== "80" && target.port !== "443") {
      throw new UnsafeTargetError(target.href, "afwijkende poort");
    }
    if (!tryNormalizeDomain(target.hostname)) {
      throw new UnsafeTargetError(target.href, "geen publiek domein");
    }
    let addresses: string[];
    try {
      addresses = await this.opts.resolveHost(target.hostname);
    } catch (err) {
      const code = (err as { code?: string }).code;
      const notFound = (code === "ENOTFOUND" || code === "ENODATA") && (await this.dnsWorks());
      throw new UnreachableError(target.href, err, notFound ? "dns" : "network");
    }
    if (addresses.length === 0 || addresses.some(isPrivateIp)) {
      throw new UnsafeTargetError(target.href, "resolvet naar een privé-adres");
    }
  }

  /** Zet requests per host in serie en houdt minIntervalMs aan. */
  private request(
    target: URL,
    accept: string,
    crawlDelaySeconds: number | null,
  ): Promise<FetchResult> {
    const key = target.host;
    const prev = this.queues.get(key) ?? Promise.resolve();
    const run = prev
      .catch(() => undefined)
      .then(() => this.requestWithRetries(target, accept, crawlDelaySeconds));
    this.queues.set(
      key,
      run.catch(() => undefined),
    );
    return run;
  }

  private async waitTurn(host: string, crawlDelaySeconds: number | null) {
    const interval = Math.max(this.opts.minIntervalMs, (crawlDelaySeconds ?? 0) * 1000);
    const wait = (this.nextAllowedAt.get(host) ?? 0) - this.opts.now();
    if (wait > 0) await this.opts.sleep(wait);
    this.nextAllowedAt.set(host, this.opts.now() + interval);
  }

  private async requestWithRetries(
    target: URL,
    accept: string,
    crawlDelaySeconds: number | null,
  ): Promise<FetchResult> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      if (attempt > 0) await this.opts.sleep(backoffMs(attempt));
      await this.waitTurn(target.host, crawlDelaySeconds);
      let result: FetchResult;
      try {
        result = await this.fetchFollowingRedirects(target, accept);
      } catch (err) {
        if (err instanceof UnsafeTargetError) throw err;
        lastError = err;
        continue;
      }
      const res = result.response;

      if (BLOCK_STATUSES.has(res.status)) {
        // 429/430: even wachten en opnieuw. 401/403: direct blocked.
        if ((res.status === 429 || res.status === 430) && attempt < this.opts.maxRetries) {
          const retryAfter = Number(res.headers.get("retry-after"));
          if (Number.isFinite(retryAfter) && retryAfter > 0)
            await this.opts.sleep(Math.min(retryAfter, 60) * 1000);
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        throw new BlockedError(target.href, res.status);
      }
      if (RETRY_STATUSES.has(res.status) && attempt < this.opts.maxRetries) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      return result;
    }
    throw new UnreachableError(target.href, lastError);
  }

  private async fetchFollowingRedirects(start: URL, accept: string): Promise<FetchResult> {
    let current = start;
    for (let hop = 0; hop <= this.opts.maxRedirects; hop++) {
      const res = await this.opts.fetch(current.href, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": this.opts.userAgent, accept },
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current);
        await this.assertSafe(current);
        continue;
      }
      return { response: res, url: current.href };
    }
    throw new UnreachableError(start.href, new Error("te veel redirects"));
  }
}

function backoffMs(attempt: number): number {
  return Math.min(30_000, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
}
