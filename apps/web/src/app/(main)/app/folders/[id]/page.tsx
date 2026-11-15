import { getFolder } from "@trendtrack/db";
import { ArrowLeft, Trash2, X } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CopyField } from "@/components/app/copy-field";
import { FolderContents } from "@/components/app/folder-contents";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/misc";
import { getSession, siteUrl } from "@/lib/server/session";
import { deleteFolderAction, removeItemAction, toggleShareAction } from "../actions";

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, workspace } = await getSession();
  const contents = await getFolder(db, workspace.id, id);
  if (!contents) notFound();
  const [t, tc] = await Promise.all([getTranslations("folders"), getTranslations("common")]);
  const { folder } = contents;
  const shareUrl = folder.share_token
    ? `${siteUrl(await headers())}/share/${folder.share_token}`
    : null;

  return (
    <>
      <Link
        href="/app/folders"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("title")}
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{folder.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("items", { count: contents.items.length })}
          </p>
        </div>
        <form action={deleteFolderAction}>
          <input type="hidden" name="folder_id" value={folder.id} />
          <Button type="submit" variant="ghost" size="sm">
            <Trash2 className="size-4" aria-hidden />
            {t("deleteConfirm")}
          </Button>
        </form>
      </header>

      <Card className="mb-8 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">{shareUrl ? t("shareOn") : t("share")}</h2>
            <p className="text-xs text-muted-foreground">{t("shareHint")}</p>
          </div>
          <form action={toggleShareAction}>
            <input type="hidden" name="folder_id" value={folder.id} />
            <input type="hidden" name="enabled" value={shareUrl ? "false" : "true"} />
            <Button type="submit" variant="outline" size="sm">
              {shareUrl ? t("shareOff") : t("share")}
            </Button>
          </form>
        </div>
        {shareUrl && (
          <div className="mt-3 max-w-xl">
            <CopyField value={shareUrl} label={t("share")} copyLabel={tc("copy")} />
          </div>
        )}
      </Card>

      {contents.items.length === 0 ? (
        <EmptyState title={t("folderEmptyTitle")}>{t("folderEmptyBody")}</EmptyState>
      ) : (
        <FolderContents
          contents={contents}
          linkInApp
          removeForm={(rowId) => (
            <form action={removeItemAction}>
              <input type="hidden" name="folder_id" value={folder.id} />
              <input type="hidden" name="row_id" value={rowId} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                aria-label={t("remove")}
                title={t("remove")}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </form>
          )}
        />
      )}
    </>
  );
}
