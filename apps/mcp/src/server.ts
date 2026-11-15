import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpContext } from "./context";
import { registerTools } from "./tools";

export const SERVER_INSTRUCTIONS = [
  "TrendTrack geeft data over webshops in Nederland en België: shops (vooral Shopify), hun producten,",
  "hun Meta-ads (uit de officiële EU Ad Library) en hun nieuwsbrieven.",
  "Omzet, bestellingen en ad spend zijn altijd schattingen met een bandbreedte (estimate: true);",
  "noem ze zo in je antwoord en geef de bandbreedte, nooit alleen één getal.",
  "Noemt de gebruiker een categorie (bv. sieraden), roep dan eerst list_filters aan voor de juiste niche-namen.",
].join(" ");

/** Eén MCP-server per request (stateless), gebonden aan de geauthenticeerde workspace. */
export function buildServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: "trendtrack", version: "1.0.0", title: "TrendTrack Benelux" },
    { instructions: SERVER_INSTRUCTIONS },
  );
  registerTools(server, ctx);
  return server;
}
