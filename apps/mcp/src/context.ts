import type { Db } from "@trendtrack/db";

/** Wie roept de MCP-server aan? Bepaald door de auth-laag, vóór de tools draaien. */
export interface McpContext {
  db: Db;
  workspaceId: string;
  /** Null bij een API-key (die hoort bij de workspace, niet bij een persoon). */
  userId: string | null;
  /** Basis-URL van de web-app, voor links in antwoorden. */
  webOrigin: string;
  log?: (entry: Record<string, unknown>) => void;
}
