import { NextResponse } from "next/server";
import { handleInbound, InboundAuthError, type InboundProvider } from "@/lib/server/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDERS = new Set<InboundProvider>(["postmark", "mailgun"]);

/**
 * Inbound-webhook voor de seed-inboxen.
 *   Postmark: https://postmark:<INBOUND_WEBHOOK_SECRET>@<host>/api/inbound/postmark
 *   Mailgun:  https://<host>/api/inbound/mailgun (handtekening met MAILGUN_WEBHOOK_SIGNING_KEY)
 * Een onbekend adres geeft 200, anders blijft de provider het opnieuw proberen.
 */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!PROVIDERS.has(provider as InboundProvider)) {
    return NextResponse.json({ error: "onbekende provider" }, { status: 404 });
  }
  try {
    const result = await handleInbound(provider as InboundProvider, req);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InboundAuthError)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "ongeldige payload" }, { status: 400 });
    }
    console.error("[inbound]", err);
    return NextResponse.json({ error: "interne fout" }, { status: 500 });
  }
}
