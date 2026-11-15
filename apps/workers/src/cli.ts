import { z } from "zod";
import { parseArgs } from "node:util";
import PgBoss from "pg-boss";
import { crawlBestsellers } from "./crawler/crawl-bestsellers";
import { crawlProducts } from "./crawler/crawl-products";
import { detectShop } from "./crawler/detect-shop";
import { runDiscovery } from "./crawler/discovery";
import { createCrawlerDeps, SEED_DOMAINS_PATH } from "./context";
import { snapshotShop } from "./snapshot/snapshot-shop";
import { discoverAds, syncAdvertiser } from "./ads/ingest";
import { createMetaClient, readMetaEnv } from "./ads/meta-env";
import { SupabaseAdsRepo } from "./repo/ads-repo";
import {
  createServiceClient,
  getOrCreateSeedInbox,
  ingestInboundEmail,
  listSeedInboxes,
  markSubscribed,
  readEmailEnv,
} from "@trendtrack/db";

const HELP = `Gebruik: pnpm workers <command> [opties]

  crawl --domain=<domein>   detect + producten + bestsellers, direct (zonder wachtrij)
  snapshot --domain=<domein> | --all [--limit=50]
                            dagelijkse snapshot + omzetschatting + growth_score
  ads --page-id=<id>        alle ads van een Facebook-pagina ophalen (Meta Ad Library API)
  ads --keyword=<woord> [--country=NL]
                            actieve ads zoeken op zoekwoord (nieuwe adverteerders vinden)
  inbox --domain=<domein>   seed-adres voor deze shop maken/tonen (om je mee in te schrijven)
  inbox --domain=<domein> --subscribed [--at=<ISO-datum>]
                            vastleggen dat je je hebt ingeschreven (standaard: nu)
  inbox --list              alle seed-inboxen
  inbox --domain=<domein> --test-mail [--hours=1]
                            nep-mail verwerken alsof hij <hours> uur na inschrijven binnenkwam
  enqueue <job> [--domain=<d>]
                            job handmatig in de wachtrij, bv. scheduler.hourly_shops of shop.snapshot
  discover [--limit=500]    nieuwe domeinen uit ads en data/seed-domains.txt in de wachtrij
`;

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      domain: { type: "string" },
      limit: { type: "string" },
      all: { type: "boolean" },
      "page-id": { type: "string" },
      keyword: { type: "string" },
      country: { type: "string" },
      subscribed: { type: "boolean" },
      at: { type: "string" },
      list: { type: "boolean" },
      "test-mail": { type: "boolean" },
      hours: { type: "string" },
    },
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
    case "snapshot": {
      const deps = createCrawlerDeps();
      const domains = values.all
        ? await deps.snapshots.activeShopifyDomains(values.limit ? Number(values.limit) : 50)
        : values.domain
          ? [values.domain]
          : [];
      if (domains.length === 0) throw new Error("Geef --domain=<domein> of --all");
      for (const domain of domains) {
        const r = await snapshotShop(domain, deps);
        console.log(domain, {
          skipped: r.skipped,
          products: r.products,
          nieuw: r.diff?.newProducts.length,
          verdwenen: r.diff?.removedProducts.length,
          prijswijzigingen: r.diff?.priceChanges.length,
          uitverkocht: r.diff?.sellouts.length,
          omzet_per_maand_schatting: r.estimate,
          growth_score: r.growthScore,
        });
      }
      return;
    }
    case "ads": {
      const { META_COUNTRIES } = readMetaEnv();
      const deps = { client: createMetaClient(), ads: new SupabaseAdsRepo(createServiceClient()) };
      const pageId = values["page-id"];
      const r = pageId
        ? await syncAdvertiser(pageId, META_COUNTRIES, deps)
        : values.keyword
          ? await discoverAds(values.keyword, (values.country ?? "NL").toUpperCase(), deps)
          : null;
      if (!r) throw new Error("Geef --page-id=<id> of --keyword=<woord>");
      console.log({
        opgeslagen: r.saved,
        gekoppeld_aan_shop: r.linkedToShop,
        nieuwe_adverteerders: r.newAdvertisers.length,
        onbekende_domeinen: r.unknownDomains,
        spend_schatting_eur: r.spend,
      });
      if (r.unknownDomains.length)
        console.log("Tip: `pnpm workers crawl --domain=<domein>` voor de onbekende domeinen.");
      return;
    }
    case "inbox": {
      const db = createServiceClient();
      const { EMAIL_INBOX_DOMAIN } = readEmailEnv();
      if (values.list) {
        for (const i of await listSeedInboxes(db)) {
          console.log(
            `${i.shops.domain.padEnd(30)} ${i.address.padEnd(50)} ingeschreven: ${i.subscribed_at ?? "nee"}`,
          );
        }
        return;
      }
      if (!values.domain) throw new Error("--domain is verplicht");
      if (values.subscribed) {
        const at = values.at ? new Date(values.at) : new Date();
        if (Number.isNaN(at.getTime())) throw new Error("--at is geen geldige datum");
        const inbox = await markSubscribed(db, values.domain, at);
        console.log(`Ingeschreven vastgelegd: ${inbox.address} op ${inbox.subscribed_at}`);
        return;
      }
      const inbox = await getOrCreateSeedInbox(db, values.domain, EMAIL_INBOX_DOMAIN);
      if (values["test-mail"]) {
        const hours = Number(values.hours ?? "1");
        const base = inbox.subscribed_at ? Date.parse(inbox.subscribed_at) : Date.now();
        const r = await ingestInboundEmail(
          db,
          {
            to: [inbox.address],
            from: `test@${values.domain}`,
            subject: `Testmail (+${hours}u)`,
            html: `<div style="display:none">Testpreheader</div><p>Dit is een testmail voor ${inbox.address}</p>`,
            text: null,
            messageId: `<test-${Date.now()}@trendtrack.local>`,
            receivedAt: new Date(base + hours * 3_600_000).toISOString(),
          },
          EMAIL_INBOX_DOMAIN,
        );
        console.log(r);
        return;
      }
      console.log(inbox.created ? "Nieuw seed-adres:" : "Bestaand seed-adres:", inbox.address);
      console.log(`Schrijf je hiermee in op de nieuwsbrief van ${values.domain} en draai daarna:`);
      console.log(`  pnpm workers inbox --domain=${values.domain} --subscribed`);
      return;
    }
    case "enqueue": {
      const name = positionals[1];
      if (!name) throw new Error("Geef een jobnaam, bv. scheduler.hourly_shops");
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL ontbreekt");
      const boss = new PgBoss(url);
      await boss.start();
      try {
        const data = values.domain ? { domain: values.domain } : {};
        console.log("job-id:", await boss.send(name, data));
      } finally {
        await boss.stop({ graceful: false });
      }
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
  if (err instanceof z.ZodError) {
    for (const issue of err.issues) console.error(issue.message);
    process.exit(1);
  }
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
