"use server";

import { createOptoutRequest } from "@trendtrack/db";
import { headers } from "next/headers";
import { z } from "zod";
import { serviceDb } from "@/lib/server/db";
import { hitPublicLimit, parseDomain, ToolError } from "@/lib/public/tools";

export interface OptoutState {
  ok?: boolean;
  message?: string;
}

const Schema = z.object({
  domain: z.string().trim().min(3).max(253),
  email: z.email().max(254),
  reason: z.string().trim().max(2000).optional(),
  owner: z.literal("on"),
});

/** Opt-out-verzoek van een shopeigenaar. Een admin controleert en keurt goed. */
export async function requestOptout(_prev: OptoutState, form: FormData): Promise<OptoutState> {
  const parsed = Schema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      message: "Vul het domein en een geldig e-mailadres in, en bevestig dat de shop van jou is.",
    };
  try {
    const domain = parseDomain(parsed.data.domain);
    const db = serviceDb();
    const hit = await hitPublicLimit(db, await headers(), "optout");
    if (!hit.allowed)
      return { message: "Te veel verzoeken vanaf dit adres. Probeer het over een uur opnieuw." };
    const r = await createOptoutRequest(db, {
      domain,
      email: parsed.data.email,
      reason: parsed.data.reason || null,
    });
    return {
      ok: true,
      message: r.existing
        ? `Er loopt al een verzoek voor ${domain}. We nemen binnen 5 werkdagen contact op.`
        : `Ontvangen. We controleren of ${parsed.data.email} bij ${domain} hoort en verwijderen de gegevens binnen 5 werkdagen.`,
    };
  } catch (err) {
    if (err instanceof ToolError) return { message: err.message };
    console.error("[opt-out]", err);
    return { message: "Dat lukte niet. Mail ons, dan regelen we het met de hand." };
  }
}
