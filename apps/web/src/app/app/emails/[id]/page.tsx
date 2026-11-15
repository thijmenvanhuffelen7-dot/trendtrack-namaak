import { getEmail, getEmailHtml, listFolders } from "@trendtrack/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { SaveToFolder } from "@/components/app/save-to-folder";
import { Badge } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import { getSession } from "@/lib/server/session";

export default async function EmailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, workspace } = await getSession();
  const email = await getEmail(db, id);
  if (!email) notFound();
  const [t, locale, html, folders] = await Promise.all([
    getTranslations("emails"),
    getLocale(),
    getEmailHtml(db, email.html_storage_path),
    listFolders(db, workspace.id),
  ]);

  return (
    <>
      <Link
        href="/app/emails"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link
              href={`/app/shops/${email.shops.domain}?tab=emails`}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {email.shops.name ?? email.shops.domain}
            </Link>
            <Badge tone={email.type === "campaign" ? "outline" : "neutral"}>
              {t(`types.${email.type}`)}
            </Badge>
            {email.flow_step && <span>{t("step", { step: email.flow_step })}</span>}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{email.subject ?? "–"}</h1>
          {email.preheader && <p className="mt-1 text-muted-foreground">{email.preheader}</p>}
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">{t("from")}</dt>
              <dd>{email.from_address}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">{t("received")}</dt>
              <dd>{formatDateTime(email.received_at, locale)}</dd>
            </div>
          </dl>
        </div>
        <SaveToFolder
          itemType="email"
          itemId={email.id}
          folders={folders.map((f) => ({ id: f.id, name: f.name }))}
        />
      </header>

      {html ? (
        <>
          {/*
            sandbox zonder allow-scripts en zonder allow-same-origin: de mail kan geen scripts draaien
            en niet bij onze cookies of pagina. De sanitizer is de eerste verdediging, dit de tweede.
          */}
          <iframe
            title={t("preview")}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            srcDoc={html}
            className="h-[75vh] w-full rounded-lg border border-border bg-white"
          />
          <p className="mt-2 text-xs text-muted-foreground">{t("sanitized")}</p>
        </>
      ) : (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">{t("noHtml")}</p>
          <p className="mt-3 max-w-2xl text-sm whitespace-pre-line">{email.text_preview ?? "–"}</p>
        </div>
      )}
    </>
  );
}
