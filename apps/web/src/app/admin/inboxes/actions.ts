"use server";

import { getOrCreateSeedInbox, markSubscribed, readEmailEnv } from "@trendtrack/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serviceDb } from "@/lib/server/db";
import { getSession } from "@/lib/server/session";

/** Server actions zijn los aan te roepen: check hier opnieuw dat het een admin is. */
async function assertAdmin() {
  const { isAdmin } = await getSession();
  if (!isAdmin) throw new Error("Geen toegang");
}

export interface ActionState {
  message: string;
  error?: boolean;
}

const DomainSchema = z.object({ domain: z.string().trim().min(3).max(253) });

export async function createInbox(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = DomainSchema.safeParse({ domain: form.get("domain") });
  if (!parsed.success) return { message: "Vul een domein in", error: true };
  try {
    const inbox = await getOrCreateSeedInbox(
      serviceDb(),
      parsed.data.domain,
      readEmailEnv().EMAIL_INBOX_DOMAIN,
    );
    revalidatePath("/admin/inboxes");
    return { message: `${inbox.created ? "Aangemaakt" : "Bestond al"}: ${inbox.address}` };
  } catch (err) {
    return { message: err instanceof Error ? err.message : "Mislukt", error: true };
  }
}

export async function subscribeNow(form: FormData): Promise<void> {
  await assertAdmin();
  const parsed = DomainSchema.parse({ domain: form.get("domain") });
  await markSubscribed(serviceDb(), parsed.domain, new Date());
  revalidatePath("/admin/inboxes");
}
