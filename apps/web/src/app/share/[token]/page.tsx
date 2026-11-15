import { getSharedFolder } from "@trendtrack/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FolderContents } from "@/components/app/folder-contents";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { serviceDb } from "@/lib/server/db";

// Gedeelde folders horen niet in zoekmachines.
export const metadata: Metadata = {
  title: "Gedeelde folder · TrendTrack",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Publieke, alleen-lezen weergave van een gedeelde folder. Het token is 32 willekeurige tekens;
 * wie het niet heeft, krijgt een 404. Leest via de service client omdat de bezoeker niet is ingelogd.
 */
export default async function SharedFolderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contents = await getSharedFolder(serviceDb(), token);
  if (!contents) notFound();
  const t = await getTranslations("folders");
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm font-semibold tracking-tight">TrendTrack</p>
      <p className="mt-6 text-sm text-muted-foreground">{t("sharedBy")}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{contents.folder.name}</h1>
      <div className="mt-8">
        {contents.items.length === 0 ? (
          <EmptyState title={t("folderEmptyTitle")} />
        ) : (
          <FolderContents contents={contents} linkInApp={false} />
        )}
      </div>
      <div className="mt-10 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted p-4 text-sm">
        <span>{t("sharedCta")}</span>
        <Link href="/login" className={buttonVariants({ size: "sm" })}>
          TrendTrack
        </Link>
      </div>
    </main>
  );
}
