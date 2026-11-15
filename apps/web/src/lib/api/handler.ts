import { API_RATE_LIMITS, cleanParams, PLANS, type UsageResult } from "@trendtrack/core";
import { checkAndRecordUsage, hitApiRateLimit, verifyApiKey, type Db } from "@trendtrack/db";
import { z } from "zod";

/**
 * Wrapper voor elk /api/v1-endpoint:
 *   1. API-key uit `Authorization: Bearer tt_live_...` (of `X-API-Key`)
 *   2. plan moet API-toegang hebben (Pro/Agency), anders 402
 *   3. rate limit per key (per seconde en per UTC-dag), anders 429
 *   4. maandquotum via checkAndRecordUsage (gedeeld met MCP), anders 402
 *   5. invoer valideren met zod (400 met details), dan het endpoint zelf
 * Fouten hebben altijd de vorm { error: { code, message, details? } }.
 */

export interface ApiContext {
  db: Db;
  workspaceId: string;
  keyId: string;
  origin: string;
  usage: UsageResult;
}

type Code =
  "bad_request" | "unauthorized" | "payment_required" | "not_found" | "rate_limited" | "internal";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: Code,
    message: string,
    readonly details?: unknown,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "not_found", `${what} niet gevonden`);

function errorResponse(e: ApiError) {
  return Response.json(
    {
      error: {
        code: e.code,
        message: e.message,
        ...(e.details === undefined ? {} : { details: e.details }),
      },
    },
    { status: e.status, headers: { "cache-control": "no-store", ...e.headers } },
  );
}

function readKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-api-key")?.trim() ?? null;
}

export function parseQuery<S extends z.ZodType>(schema: S, req: Request): z.infer<S> {
  const raw = Object.fromEntries(new URL(req.url).searchParams.entries());
  const r = schema.safeParse(cleanParams(raw));
  if (!r.success)
    throw new ApiError(
      400,
      "bad_request",
      "Ongeldige parameters",
      z.flattenError(r.error as z.ZodError).fieldErrors,
    );
  return r.data;
}

export async function parseBody<S extends z.ZodType>(schema: S, req: Request): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "bad_request", "Body moet geldige JSON zijn");
  }
  const r = schema.safeParse(json);
  if (!r.success)
    throw new ApiError(
      400,
      "bad_request",
      "Ongeldige body",
      z.flattenError(r.error as z.ZodError).fieldErrors,
    );
  return r.data;
}

export function apiRoute<P = Record<string, string>>(
  getDb: () => Db,
  fn: (req: Request, ctx: ApiContext, params: P) => Promise<unknown>,
  opts: { status?: number } = {},
) {
  return async (req: Request, route: { params: Promise<P> }): Promise<Response> => {
    try {
      const db = getDb();
      const key = readKey(req);
      if (!key)
        throw new ApiError(
          401,
          "unauthorized",
          "API-key ontbreekt. Stuur: Authorization: Bearer tt_live_...",
        );
      const auth = await verifyApiKey(db, key);
      if (!auth) throw new ApiError(401, "unauthorized", "Ongeldige of ingetrokken API-key");

      // Quotumcheck zonder vast te leggen: ook het plan komt hier vandaan.
      const pre = await checkAndRecordUsage(db, auth.workspaceId, "api_call", {
        source: "api",
        record: false,
      });
      const origin = new URL(req.url).origin;
      if (pre.reason === "not_in_plan") {
        throw new ApiError(
          402,
          "payment_required",
          `De API zit niet in het ${PLANS[pre.plan].name}-plan. Upgrade naar Pro of Agency.`,
          {
            plan: pre.plan,
            upgrade_url: `${origin}/app/settings/billing`,
          },
        );
      }

      const rate = API_RATE_LIMITS[pre.plan];
      const hit = await hitApiRateLimit(db, auth.keyId, rate.perSecond, rate.perDay);
      const rateHeaders = {
        "x-ratelimit-limit": String(rate.perDay),
        "x-ratelimit-remaining": String(Math.max(0, rate.perDay - hit.dayCount)),
        "x-ratelimit-reset": hit.dayReset,
      };
      if (!hit.allowed) {
        const retry =
          hit.limitedBy === "second"
            ? 1
            : Math.max(1, Math.ceil((Date.parse(hit.dayReset) - Date.now()) / 1000));
        throw new ApiError(
          429,
          "rate_limited",
          hit.limitedBy === "second"
            ? `Maximaal ${rate.perSecond} requests per seconde`
            : `Maximaal ${rate.perDay} requests per dag`,
          { limited_by: hit.limitedBy },
          { ...rateHeaders, "retry-after": String(retry) },
        );
      }

      const usage = await checkAndRecordUsage(db, auth.workspaceId, "api_call", { source: "api" });
      if (!usage.allowed) {
        throw new ApiError(
          402,
          "payment_required",
          `Je maandquotum van ${usage.limit} API- en MCP-calls is op.`,
          {
            plan: usage.plan,
            limit: usage.limit,
            used: usage.used,
            resets_at: usage.resetsAt,
            upgrade_url: `${origin}/app/settings/billing`,
          },
          rateHeaders,
        );
      }

      const body = await fn(
        req,
        { db, workspaceId: auth.workspaceId, keyId: auth.keyId, origin, usage },
        await route.params,
      );
      return Response.json(body, {
        status: opts.status ?? 200,
        headers: {
          ...rateHeaders,
          "x-quota-limit": String(usage.limit ?? ""),
          "x-quota-remaining": String(usage.remaining ?? ""),
          "cache-control": "no-store",
        },
      });
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err);
      console.error("[api]", err);
      return errorResponse(new ApiError(500, "internal", "Er ging iets mis aan onze kant"));
    }
  };
}
