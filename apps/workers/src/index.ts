import PgBoss from "pg-boss";

/** Start de pg-boss worker. Job-handlers worden vanaf Prompt 3 geregistreerd. */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL ontbreekt (zie .env.example)");

  const boss = new PgBoss(connectionString);
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();
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
