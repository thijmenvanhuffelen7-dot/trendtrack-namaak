import PgBoss from "pg-boss";
import { createCrawlerDeps, SEED_DOMAINS_PATH } from "./context";
import { createMetaClient, readMetaEnv } from "./ads/meta-env";
import { createServiceClient, readEmailEnv } from "@trendtrack/db";
import { startImapPoller } from "./email/imap-poller";
import { SupabaseAdsRepo } from "./repo/ads-repo";
import { registerAdsJobs, registerShopJobs } from "./register";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL ontbreekt (zie .env.example)");

  const boss = new PgBoss(connectionString);
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();
  await registerShopJobs(boss, createCrawlerDeps(), SEED_DOMAINS_PATH);
  if (process.env.META_ACCESS_TOKEN) {
    const { META_COUNTRIES } = readMetaEnv();
    await registerAdsJobs(
      boss,
      { client: createMetaClient(), ads: new SupabaseAdsRepo(createServiceClient()) },
      META_COUNTRIES,
    );
  } else {
    console.warn("META_ACCESS_TOKEN ontbreekt: ads-jobs staan uit");
  }
  // E-mail via IMAP (alternatief voor de inbound-webhook in de web-app).
  let stopImap: (() => void) | undefined;
  if (process.env.EMAIL_INBOUND_MODE === "imap") {
    stopImap = startImapPoller(createServiceClient(), readEmailEnv().EMAIL_INBOX_DOMAIN);
    console.log("IMAP-poller gestart");
  }
  console.log("workers gestart");

  const stop = async () => {
    stopImap?.();
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
