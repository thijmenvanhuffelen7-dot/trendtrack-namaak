import PgBoss from "pg-boss";
import { createCrawlerDeps, SEED_DOMAINS_PATH } from "./context";
import { registerShopJobs } from "./register";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL ontbreekt (zie .env.example)");

  const boss = new PgBoss(connectionString);
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();
  await registerShopJobs(boss, createCrawlerDeps(), SEED_DOMAINS_PATH);
  console.log("workers gestart");

  const stop = async () => {
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
