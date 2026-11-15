"use server";

import { approveOptout, rejectOptout } from "@trendtrack/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serviceDb } from "@/lib/server/db";
import { getSession } from "@/lib/server/session";

const Schema = z.object({
  id: z.guid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

/** Opt-out goedkeuren (alles weg) of afwijzen. Alleen admins; server actions zijn los aan te roepen. */
export async function decideOptout(form: FormData) {
  const { user, isAdmin } = await getSession();
  if (!isAdmin) throw new Error("Geen toegang");
  const { id, decision, note } = Schema.parse(Object.fromEntries(form));
  if (decision === "approve") await approveOptout(serviceDb(), id, user.id, note);
  else await rejectOptout(serviceDb(), id, user.id, note);
  revalidatePath("/admin/opt-out");
}
