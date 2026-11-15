"use server";

import {
  createFolder,
  deleteFolder,
  removeFolderItem,
  setDailyDigest,
  setFolderSharing,
} from "@trendtrack/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serviceDb } from "@/lib/server/db";
import { getSession } from "@/lib/server/session";

const id = z.guid();

export async function createFolderAction(form: FormData) {
  const name = z.string().trim().min(1).max(80).parse(form.get("name"));
  const { user, workspace } = await getSession();
  const folder = await createFolder(serviceDb(), workspace.id, user.id, name);
  revalidatePath("/app/folders");
  redirect(`/app/folders/${folder.id}`);
}

export async function deleteFolderAction(form: FormData) {
  const folderId = id.parse(form.get("folder_id"));
  const { workspace } = await getSession();
  await deleteFolder(serviceDb(), workspace.id, folderId);
  revalidatePath("/app/folders");
  redirect("/app/folders");
}

export async function removeItemAction(form: FormData) {
  const folderId = id.parse(form.get("folder_id"));
  const rowId = id.parse(form.get("row_id"));
  const { workspace } = await getSession();
  await removeFolderItem(serviceDb(), workspace.id, folderId, rowId);
  revalidatePath(`/app/folders/${folderId}`);
}

export async function toggleShareAction(form: FormData) {
  const folderId = id.parse(form.get("folder_id"));
  const enabled = form.get("enabled") === "true";
  const { workspace } = await getSession();
  await setFolderSharing(serviceDb(), workspace.id, folderId, enabled);
  revalidatePath(`/app/folders/${folderId}`);
  revalidatePath("/app/folders");
}

export async function toggleDigestAction(form: FormData) {
  const shopId = id.parse(form.get("shop_id"));
  const enabled = form.get("enabled") === "true";
  const { workspace } = await getSession();
  await setDailyDigest(serviceDb(), workspace.id, shopId, enabled);
  revalidatePath("/app/brandtracker");
}
