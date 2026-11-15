"use server";

import { tryNormalizeDomain } from "@trendtrack/core";
import {
  addFolderItem,
  createFolder,
  getShopByDomain,
  requestLookup,
  trackBrand,
  untrackBrand,
  type FolderItemType,
} from "@trendtrack/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/i18n/request";
import { serviceDb } from "@/lib/server/db";
import { getSession } from "@/lib/server/session";

/**
 * Zoekbalk: een domein gaat naar de shop-pagina (onbekend => lookup aanvragen), iets anders
 * wordt een zoekopdracht in de shopslijst.
 */
export async function searchAction(form: FormData) {
  const q = String(form.get("q") ?? "")
    .trim()
    .slice(0, 200);
  if (!q) redirect("/app/shops");
  const domain = /\.[a-z]{2,}/i.test(q) && !/\s/.test(q) ? tryNormalizeDomain(q) : null;
  if (!domain) redirect(`/app/shops?q=${encodeURIComponent(q)}`);

  const { db, user, workspace } = await getSession();
  const shop = await getShopByDomain(db, domain);
  if (!shop) await requestLookup(serviceDb(), workspace.id, user.id, domain, "web");
  redirect(`/app/shops/${domain}`);
}

/** Onbekende shop (opnieuw) laten ophalen vanaf de shop-pagina. */
export async function fetchShopAction(form: FormData) {
  const domain = tryNormalizeDomain(String(form.get("domain") ?? ""));
  if (!domain) redirect("/app/shops");
  const { user, workspace } = await getSession();
  await requestLookup(serviceDb(), workspace.id, user.id, domain, "web");
  revalidatePath(`/app/shops/${domain}`);
}

const TrackSchema = z.object({
  shop_id: z.guid(),
  follow: z.enum(["true", "false"]),
  path: z.string().startsWith("/app"),
});

export async function toggleTrackAction(form: FormData) {
  const { shop_id, follow, path } = TrackSchema.parse(Object.fromEntries(form));
  const { user, workspace } = await getSession();
  if (follow === "true") await trackBrand(serviceDb(), workspace.id, user.id, shop_id);
  else await untrackBrand(serviceDb(), workspace.id, shop_id);
  revalidatePath(path);
  revalidatePath("/app/brandtracker");
}

const SaveSchema = z.object({
  item_type: z.enum(["ad", "shop", "email"]),
  item_id: z.guid(),
  folder_id: z.string(),
  new_name: z.string().max(80).optional(),
});

export interface SaveState {
  status: "idle" | "saved" | "error";
  folderName?: string;
}

/** Opslaan in een bestaande folder, of in een nieuwe als folder_id "new" is. */
export async function saveToFolderAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const parsed = SaveSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error" };
  const { item_type, item_id, folder_id, new_name } = parsed.data;
  const { db, user, workspace } = await getSession();
  const service = serviceDb();
  try {
    let folderId = folder_id;
    let folderName = "";
    if (folder_id === "new") {
      if (!new_name?.trim()) return { status: "error" };
      const folder = await createFolder(service, workspace.id, user.id, new_name);
      folderId = folder.id;
      folderName = folder.name;
    } else {
      const { data } = await db.from("folders").select("name").eq("id", folder_id).maybeSingle();
      if (!data) return { status: "error" };
      folderName = data.name;
    }
    await addFolderItem(service, workspace.id, user.id, folderId, {
      type: item_type as FolderItemType,
      id: item_id,
    });
    revalidatePath("/app/folders");
    return { status: "saved", folderName };
  } catch (err) {
    console.error("[saveToFolder]", err);
    return { status: "error" };
  }
}

export async function setLocaleAction(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "nl";
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  const { user } = await getSession();
  await serviceDb().from("profiles").update({ locale }).eq("id", user.id);
  revalidatePath("/", "layout");
}
