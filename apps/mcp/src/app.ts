import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { reportError } from "@trendtrack/core";
import type { Db } from "@trendtrack/db";
import express, { type Express } from "express";
import { authenticate } from "./auth";
import { buildServer } from "./server";

export interface AppConfig {
  db: Db;
  /** Publieke URL van deze MCP-server, bv. https://mcp.jouwdomein.nl */
  publicUrl: string;
  /** Publieke URL van de web-app (autorisatieserver en links in antwoorden). */
  webOrigin: string;
  log?: (entry: Record<string, unknown>) => void;
}

/**
 * HTTP-laag: Streamable HTTP op /mcp (stateless), OAuth Protected Resource Metadata (RFC 9728)
 * en /health. Zonder geldig token: 401 met WWW-Authenticate, zodat clients de OAuth-flow starten.
 */
export function createApp(cfg: AppConfig): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  // MCP Inspector en andere browserclients hebben CORS nodig. Geen cookies: tokens in de header.
  app.use((req, res, next) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "access-control-allow-headers",
      "authorization, content-type, mcp-session-id, mcp-protocol-version, last-event-id",
    );
    res.setHeader("access-control-expose-headers", "mcp-session-id, www-authenticate");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  const resourceMetadataUrl = `${cfg.publicUrl}/.well-known/oauth-protected-resource`;
  const metadata = () => ({
    resource: `${cfg.publicUrl}/mcp`,
    authorization_servers: [cfg.webOrigin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp"],
    resource_name: "TrendTrack Benelux",
    resource_documentation: `${cfg.webOrigin}/app/mcp`,
  });
  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json(metadata());
  });
  app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
    res.json(metadata());
  });

  // Voor uptime-checks: 200 als de database bereikbaar is, anders 503. /mcp/health is hetzelfde
  // adres op een gedeeld domein (Vercel), waar /health niet naar deze service gaat.
  app.get(["/health", "/mcp/health"], async (_req, res) => {
    const { error } = await cfg.db.from("plans").select("id").limit(1);
    res.status(error ? 503 : 200).json({ ok: !error });
  });

  app.post("/mcp", async (req, res) => {
    const auth = await authenticate(cfg.db, req.headers.authorization).catch(() => null);
    if (!auth) {
      res
        .status(401)
        .setHeader(
          "www-authenticate",
          `Bearer resource_metadata="${resourceMetadataUrl}", scope="mcp"`,
        )
        .json({
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: "Niet ingelogd: gebruik OAuth of een API-key (Bearer tt_live_...)",
          },
          id: null,
        });
      return;
    }
    const server = buildServer({
      db: cfg.db,
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      webOrigin: cfg.webOrigin,
      log: cfg.log,
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      cfg.log?.({ error: String(err) });
      void reportError(err, { service: "mcp" });
      if (!res.headersSent)
        res
          .status(500)
          .json({ jsonrpc: "2.0", error: { code: -32603, message: "Interne fout" }, id: null });
    }
  });

  // Stateless: geen sessies, dus GET (SSE-stream) en DELETE (sessie sluiten) bestaan niet.
  const notAllowed = (_req: express.Request, res: express.Response) => {
    res
      .status(405)
      .setHeader("allow", "POST")
      .json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
  };
  app.get("/mcp", notAllowed);
  app.delete("/mcp", notAllowed);
  return app;
}
