import { listFolders } from "@trendtrack/db";
import { Folder } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { getSession } from "@/lib/server/session";
import { createFolderAction } from "./actions";

export default async function FoldersPage() {
  const { db, workspace } = await getSession();
  const [t, locale, folders] = await Promise.all([
    getTranslations("folders"),
    getLocale(),
    listFolders(db, workspace.id),
  ]);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <form action={createFolderAction} className="mb-6 flex flex-wrap items-center gap-2">
        <label htmlFor="folder-name" className="sr-only">
          {t("name")}
        </label>
        <Input
          id="folder-name"
          name="name"
          required
          maxLength={80}
          placeholder={t("new")}
          className="w-64"
        />
        <Button type="submit">{t("create")}</Button>
      </form>
      {folders.length === 0 ? (
        <EmptyState title={t("emptyTitle")}>{t("emptyBody")}</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {folders.map((f) => (
            <li key={f.id}>
              <Link
                href={`/app/folders/${f.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/25"
              >
                <Folder className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("items", { count: f.itemCount })} · {formatDate(f.created_at, locale)}
                  </span>
                </span>
                {f.share_token && <Badge tone="neutral">{t("shared")}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
