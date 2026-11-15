"use server";

import { AFFILIATE_CODE, createAffiliate } from "@trendtrack/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serviceDb } from "@/lib/server/db";
import { getSession } from "@/lib/server/session";

const Schema = z.object({ code: z.string().trim().toLowerCase().regex(AFFILIATE_CODE) });

export async function createAffiliateAction(form: FormData) {
  const { user } = await getSession();
  const parsed = Schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/app/settings/affiliate?error=invalid");
  const row = await createAffiliate(serviceDb(), user.id, parsed.data.code);
  if (!row) redirect("/app/settings/affiliate?error=taken");
  revalidatePath("/app/settings/affiliate");
  redirect("/app/settings/affiliate");
}
