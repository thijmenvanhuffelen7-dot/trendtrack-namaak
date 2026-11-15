"use server";

import { createApiKey, revokeApiKey } from "@trendtrack/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serviceDb } from "@/lib/server/db";
import { getSession } from "@/lib/server/session";

export interface CreateKeyState {
  status: "idle" | "created" | "error";
  key?: string;
  message?: string;
}

export async function createKeyAction(
  _prev: CreateKeyState,
  form: FormData,
): Promise<CreateKeyState> {
  const name = z.string().trim().min(1).max(60).safeParse(form.get("name"));
  if (!name.success) return { status: "error", message: "naam ontbreekt" };
  const { user, workspace } = await getSession();
  try {
    const created = await createApiKey(serviceDb(), workspace.id, user.id, name.data);
    revalidatePath("/app/api");
    return { status: "created", key: created.key };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "onbekende fout" };
  }
}

export async function revokeKeyAction(form: FormData) {
  const id = z.guid().parse(form.get("key_id"));
  const { workspace } = await getSession();
  await revokeApiKey(serviceDb(), workspace.id, id);
  revalidatePath("/app/api");
}
