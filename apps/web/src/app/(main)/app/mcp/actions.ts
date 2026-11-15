"use server";

import { revokeClient } from "@trendtrack/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serviceDb } from "@/lib/server/db";
import { getSession } from "@/lib/server/session";

export async function revokeClientAction(form: FormData) {
  const clientId = z.string().min(5).max(100).parse(form.get("client_id"));
  const { workspace } = await getSession();
  await revokeClient(serviceDb(), workspace.id, clientId);
  revalidatePath("/app/mcp");
}
