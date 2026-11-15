import { parseArgs } from "node:util";
import PgBoss from "pg-boss";
import { crawlBestsellers } from "./crawler/crawl-bestsellers";
import { crawlProducts } from "./crawler/crawl-products";
import { detectShop } from "./crawler/detect-shop";
import { runDiscovery } from "./crawler/discovery";
import { createCrawlerDeps, SEED_DOMAINS_PATH } from "./context";

const HELP = `Gebruik: pnpm workers <command> [opties]

  crawl --domain=<domein>   detect + producten + bestsellers, direct (zonder wachtrij)
  discover [--limit=500]    nieuwe domeinen uit ads en data/seed-domains.txt in de wachtrij
`;

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { domain: { type: "string" }, limit: { type: "string" } },
  });
  const [command] = positionals;

  switch (command) {
    case "crawl": {
      if (!values.domain) throw new Error("--domain is verplicht");
      const deps = createCrawlerDeps();
      const detected = await detectShop(values.domain, deps);
      console.log("detect:", {
        domain: detected.domain,
        status: detected.status,
        shopify: detected.isShopify,
        name: detected.info?.name,
        theme: detected.info?.themeName,
        country: detected.info?.country,
        currency: detected.info?.currency,
        apps: detected.info?.apps,
        linkedAds: detected.linkedAds,
      });
      if (detected.status !== "active" || !detected.isShopify) return;
      console.log("products:", await crawlProducts(detected.domain, deps));
      console.log("bestsellers:", await crawlBestsellers(detected.domain, deps));
      return;
    }
    case "discover": {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL ontbreekt");
      const boss = new PgBoss(url);
      await boss.start();
      try {
        const deps = createCrawlerDeps();
        const limit = values.limit ? Number(values.limit) : 500;
        console.log(
          await runDiscovery(
            { repo: deps.repo, queue: boss, seedFilePath: SEED_DOMAINS_PATH },
            limit,
          ),
        );
      } finally {
        await boss.stop({ graceful: false });
      }
      return;
    }
    default:
      console.log(HELP);
      if (command && command !== "help") process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
