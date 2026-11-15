import { randomBytes } from "node:crypto";
import { normalizeDomain } from "@trendtrack/core";
import type { Db } from "../client";
import { getAdsByIds } from "./ads";
import { getEmailsByIds } from "./emails";

export type FolderItemType = "ad" | "shop" | "email";

/** Workspace van de gebruiker (voorlopig de eerste waar hij lid van is). */
export async function getWorkspaceForUser(db: Db, userId: string) {
  const { data, error } = await db
    .from("workspace_members")
    .select("role, workspaces!inner(id, name)")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.workspaces.id, name: data.workspaces.name, role: data.role } : null;
}

// --- Folders ------------------------------------------------------------------------------------

export async function listFolders(db: Db, workspaceId: string) {
  const { data, error } = await db
    .from("folders")
    .select("id, name, share_token, created_at, folder_items(count)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(({ folder_items, ...f }) => ({ ...f, itemCount: folder_items[0]?.count ?? 0 }));
}

async function resolveItems(db: Db, folderId: string) {
  const { data: items, error } = await db
    .from("folder_items")
    .select("id, item_type, item_id, note, created_at")
    .eq("folder_id", folderId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (t: FolderItemType) => items.filter((i) => i.item_type === t).map((i) => i.item_id);
  const [ads, emails, shops] = await Promise.all([
    getAdsByIds(db, ids("ad")),
    getEmailsByIds(db, ids("email")),
    ids("shop").length
      ? db
          .from("shops")
          .select(
            "id, domain, name, country, niche, active_ads_count, growth_score, est_monthly_revenue_low, est_monthly_revenue_high",
          )
          .in("id", ids("shop"))
          .then((r) => {
            if (r.error) throw r.error;
            return r.data;
          })
      : Promise.resolve([]),
  ]);
  return { items, ads, emails, shops };
}

export async function getFolder(db: Db, workspaceId: string, folderId: string) {
  const { data: folder, error } = await db
    .from("folders")
    .select("id, name, share_token, created_at")
    .eq("id", folderId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return folder ? { folder, ...(await resolveItems(db, folder.id)) } : null;
}

/** Publieke, alleen-lezen weergave via de deellink. Aanroepen met de service client. */
export async function getSharedFolder(serviceDb: Db, token: string) {
  if (!/^[a-z0-9]{16,64}$/.test(token)) return null;
  const { data: folder, error } = await serviceDb
    .from("folders")
    .select("id, name, created_at")
    .eq("share_token", token)
    .maybeSingle();
  if (error) throw error;
  return folder ? { folder, ...(await resolveItems(serviceDb, folder.id)) } : null;
}

// Schrijven: alleen met de service client, na een auth-check in de aanroeper.

export async function createFolder(
  serviceDb: Db,
  workspaceId: string,
  userId: string,
  name: string,
) {
  const { data, error } = await serviceDb
    .from("folders")
    .insert({ workspace_id: workspaceId, created_by: userId, name: name.trim().slice(0, 80) })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}

async function assertFolderInWorkspace(serviceDb: Db, workspaceId: string, folderId: string) {
  const { data } = await serviceDb
    .from("folders")
    .select("id")
    .eq("id", folderId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data) throw new Error("Folder niet gevonden");
}

export async function deleteFolder(serviceDb: Db, workspaceId: string, folderId: string) {
  const { error } = await serviceDb
    .from("folders")
    .delete()
    .eq("id", folderId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
}

export async function addFolderItem(
  serviceDb: Db,
  workspaceId: string,
  userId: string,
  folderId: string,
  item: { type: FolderItemType; id: string },
) {
  await assertFolderInWorkspace(serviceDb, workspaceId, folderId);
  const { error } = await serviceDb
    .from("folder_items")
    .upsert(
      { folder_id: folderId, item_type: item.type, item_id: item.id, added_by: userId },
      { onConflict: "folder_id,item_type,item_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function removeFolderItem(
  serviceDb: Db,
  workspaceId: string,
  folderId: string,
  itemRowId: string,
) {
  await assertFolderInWorkspace(serviceDb, workspaceId, folderId);
  const { error } = await serviceDb
    .from("folder_items")
    .delete()
    .eq("id", itemRowId)
    .eq("folder_id", folderId);
  if (error) throw error;
}

/** Zet delen aan (nieuw token) of uit. */
export async function setFolderSharing(
  serviceDb: Db,
  workspaceId: string,
  folderId: string,
  enabled: boolean,
) {
  const token = enabled ? randomBytes(16).toString("hex") : null;
  const { data, error } = await serviceDb
    .from("folders")
    .update({ share_token: token })
    .eq("id", folderId)
    .eq("workspace_id", workspaceId)
    .select("share_token")
    .single();
  if (error) throw error;
  return data.share_token;
}

// --- Brandtracker -------------------------------------------------------------------------------

export async function listTrackedBrands(db: Db, workspaceId: string) {
  const { data, error } = await db
    .from("tracked_brands")
    .select(
      "id, daily_digest, created_at, shops!inner(id, domain, name, country, niche, active_ads_count, growth_score, est_monthly_revenue_low, est_monthly_revenue_high)",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function isTracked(db: Db, workspaceId: string, shopId: string) {
  const { data } = await db
    .from("tracked_brands")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("shop_id", shopId)
    .maybeSingle();
  return Boolean(data);
}

export async function trackBrand(
  serviceDb: Db,
  workspaceId: string,
  userId: string | null,
  shopId: string,
) {
  const { error } = await serviceDb
    .from("tracked_brands")
    .upsert(
      { workspace_id: workspaceId, shop_id: shopId, added_by: userId },
      { onConflict: "workspace_id,shop_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function untrackBrand(serviceDb: Db, workspaceId: string, shopId: string) {
  const { error } = await serviceDb
    .from("tracked_brands")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("shop_id", shopId);
  if (error) throw error;
}

export async function setDailyDigest(
  serviceDb: Db,
  workspaceId: string,
  shopId: string,
  enabled: boolean,
) {
  const { error } = await serviceDb
    .from("tracked_brands")
    .update({ daily_digest: enabled })
    .eq("workspace_id", workspaceId)
    .eq("shop_id", shopId);
  if (error) throw error;
}

// --- Lookups --------------------------------------------------------------------------------------

/** Vraagt een onbekend domein aan. De workers pakken dit binnen enkele seconden op. */
export async function requestLookup(
  serviceDb: Db,
  workspaceId: string,
  userId: string | null,
  domainInput: string,
  source: "web" | "api" | "mcp" = "web",
) {
  const domain = normalizeDomain(domainInput);
  const { data: open } = await serviceDb
    .from("lookup_requests")
    .select("id, status, domain")
    .eq("workspace_id", workspaceId)
    .eq("domain", domain)
    .in("status", ["queued", "processing"])
    .limit(1)
    .maybeSingle();
  if (open) return open;
  const { data, error } = await serviceDb
    .from("lookup_requests")
    .insert({ workspace_id: workspaceId, requested_by: userId, domain, source })
    .select("id, status, domain")
    .single();
  if (error) throw error;
  return data;
}

export async function getLatestLookup(db: Db, workspaceId: string, domain: string) {
  const { data, error } = await db
    .from("lookup_requests")
    .select("id, domain, status, error, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("domain", domain)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
