/** CLI voor handmatige runs, bv. `pnpm workers crawl --domain=shop.nl` (vanaf Prompt 3). */
const [command] = process.argv.slice(2);

switch (command) {
  case undefined:
  case "help":
    console.log("Gebruik: pnpm workers <command>\nCommands komen in Prompt 3 en verder.");
    break;
  default:
    console.error(`Onbekend command: ${command}`);
    process.exit(1);
}
