import { createServiceClient, readEmailEnv } from "@trendtrack/db";
import PgBoss from "pg-boss";
import { createMetaClient, readMetaEnv } from "./ads/meta-env";
import { readConfig } from "./config";
import { createCrawlerDeps, KEYWORDS_PATH, SEED_DOMAINS_PATH } from "./context";
import { startImapPoller } from "./email/imap-poller";
import { startHealthServer } from "./health";
import { closePool, getPool } from "./infra/pg";
import { registerAll } from "./register";
import { SupabaseAdsRepo } from "./repo/ads-repo";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL ontbreekt (zie .env.example)");
  const config = readConfig();
  const pool = getPool();

  const boss = new PgBoss(connectionString);
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();

  const metaEnabled = Boolean(process.env.META_ACCESS_TOKEN);
  if (!metaEnabled) console.warn("META_ACCESS_TOKEN ontbreekt: ads-jobs staan uit");
  await registerAll({
    boss,
    pool,
    config,
    shop: createCrawlerDeps(),
    ads: metaEnabled
      ? { client: createMetaClient(), ads: new SupabaseAdsRepo(createServiceClient()) }
      : null,
    metaCountries: metaEnabled ? readMetaEnv().META_COUNTRIES : [],
    seedFilePath: SEED_DOMAINS_PATH,
    keywordsPath: KEYWORDS_PATH,
  });

  // E-mail via IMAP (alternatief voor de inbound-webhook in de web-app).
  let stopImap: (() => void) | undefined;
  if (process.env.EMAIL_INBOUND_MODE === "imap") {
    stopImap = startImapPoller(createServiceClient(), readEmailEnv().EMAIL_INBOX_DOMAIN);
    console.log("IMAP-poller gestart");
  }

  const health = startHealthServer(pool, config.WORKER_HEALTH_PORT, () => ({
    meta: metaEnabled,
    imap: Boolean(stopImap),
    scheduler: config.SCHEDULER_ENABLED,
  }));
  console.log(`workers gestart (health op :${config.WORKER_HEALTH_PORT}/health)`);

  const stop = async () => {
    stopImap?.();
    health.close();
    await boss.stop({ graceful: true, timeout: 30_000 });
    await closePool();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
