import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Bouwt de MCP-server met alle tools. Echte tools volgen in Prompt 12. */
export function buildServer(): McpServer {
  const server = new McpServer({ name: "trendtrack", version: "0.0.0" });

  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Controleert of de TrendTrack MCP-server bereikbaar is.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => ({ content: [{ type: "text", text: "pong" }] }),
  );

  return server;
}
