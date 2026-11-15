/**
 * Optionele foutmelding naar Sentry (of een compatibele dienst zoals GlitchTip), zonder SDK.
 * Alleen actief als SENTRY_DSN gezet is; anders doet reportError niets behalve loggen.
 * Gebruikt de envelope-API: https://develop.sentry.dev/sdk/envelopes/
 */
export interface Dsn {
  publicKey: string;
  host: string;
  protocol: string;
  projectId: string;
  pathPrefix: string;
}

export function parseDsn(dsn: string): Dsn | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.split("/").filter(Boolean).pop();
    if (!u.username || !projectId || !/^\d+$/.test(projectId)) return null;
    const prefix = u.pathname.slice(0, u.pathname.lastIndexOf("/"));
    return {
      publicKey: u.username,
      host: u.host,
      protocol: u.protocol,
      projectId,
      pathPrefix: prefix,
    };
  } catch {
    return null;
  }
}

export interface ErrorContext {
  service: "web" | "workers" | "mcp";
  environment?: string;
  release?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export function buildEnvelope(err: unknown, ctx: ErrorContext, dsn: string, now = new Date()) {
  const e = err instanceof Error ? err : new Error(String(err));
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const header = { event_id: eventId, dsn, sent_at: now.toISOString() };
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: "node",
    level: "error",
    server_name: ctx.service,
    environment: ctx.environment ?? "production",
    ...(ctx.release ? { release: ctx.release } : {}),
    tags: { service: ctx.service, ...ctx.tags },
    // Geen persoonsgegevens: alleen wat de aanroeper expliciet meegeeft.
    extra: { stack: e.stack?.split("\n").slice(0, 30).join("\n"), ...ctx.extra },
    exception: { values: [{ type: e.name, value: e.message.slice(0, 1000) }] },
  };
  return {
    eventId,
    body: `${JSON.stringify(header)}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}\n`,
  };
}

/** Logt de fout en stuurt hem (best effort, met timeout) naar Sentry als SENTRY_DSN gezet is. */
export async function reportError(
  err: unknown,
  ctx: ErrorContext,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  console.error(`[${ctx.service}]`, err);
  const dsnString = env.SENTRY_DSN;
  const dsn = dsnString ? parseDsn(dsnString) : null;
  if (!dsnString || !dsn) return null;
  const { eventId, body } = buildEnvelope(
    err,
    { environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV, release: env.GIT_SHA, ...ctx },
    dsnString,
  );
  try {
    await fetchImpl(
      `${dsn.protocol}//${dsn.host}${dsn.pathPrefix}/api/${dsn.projectId}/envelope/`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-sentry-envelope",
          "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=trendtrack/1.0`,
        },
        body,
        signal: AbortSignal.timeout(3000),
      },
    );
    return eventId;
  } catch {
    return null; // Monitoring mag de app nooit laten falen.
  }
}
