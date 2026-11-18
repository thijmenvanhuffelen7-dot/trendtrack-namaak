import { adRunDays, type getFolder } from "@trendtrack/db";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/misc";
import { formatDate, formatMoneyRange, formatNumber } from "@/lib/format";

// De folder zelf gebruiken we hier niet; zo past ook de gedeelde variant (zonder share_token).
type Contents = Omit<NonNullable<Awaited<ReturnType<typeof getFolder>>>, "folder">;

/**
 * Inhoud van een folder, gegroepeerd per soort. `linkInApp` = links naar het dashboard (voor
 * leden); op de publieke deelpagina linken we alleen naar buiten. `removeForm` voegt een
 * "uit folder halen"-knop toe.
 */
export async function FolderContents({
  contents,
  linkInApp,
  removeForm,
}: {
  contents: Contents;
  linkInApp: boolean;
  removeForm?: (rowId: string) => React.ReactNode;
}) {
  const [t, ta, tc, te, locale] = await Promise.all([
    getTranslations("folders"),
    getTranslations("ads"),
    getTranslations("common"),
    getTranslations("emails"),
    getLocale(),
  ]);
  const rowId = (type: string, id: string) =>
    contents.items.find((i) => i.item_type === type && i.item_id === id)?.id ?? "";
  const row = (
    key: string,
    main: React.ReactNode,
    meta: React.ReactNode,
    type: string,
    id: string,
  ) => (
    <li key={key} className="flex items-start gap-3 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{main}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{meta}</div>
      </div>
      {removeForm?.(rowId(type, id))}
    </li>
  );
  const section = (title: string, rows: React.ReactNode[]) =>
    rows.length > 0 && (
      <section>
        <h2 className="mb-2 font-medium">
          {title} <span className="text-muted-foreground">({rows.length})</span>
        </h2>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">{rows}</ul>
      </section>
    );

  return (
    <div className="space-y-8">
      {section(
        t("sectionAds"),
        contents.ads.map((ad) => {
          const days = adRunDays(ad);
          const label = ad.title ?? ad.body?.slice(0, 80) ?? ta("noText");
          return row(
            ad.id,
            linkInApp ? (
              <Link href={`/app/ads?ad=${ad.id}`} className="underline-offset-2 hover:underline">
                {label}
              </Link>
            ) : ad.snapshot_url ? (
              <a
                href={ad.snapshot_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {label}
              </a>
            ) : (
              label
            ),
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{ad.advertisers?.page_name ?? ad.landing_domain}</span>
              <Badge tone={ad.is_active ? "positive" : "outline"}>
                {ad.is_active ? tc("active") : tc("inactive")}
              </Badge>
              {days !== null && <span>{tc("days", { count: days })}</span>}
              <span>
                {ta("reach")}: {formatNumber(ad.eu_total_reach, locale, true)}
              </span>
              <span>
                {ta("spend")}:{" "}
                {formatMoneyRange(ad.est_spend_low, ad.est_spend_high, locale) ?? "–"} (
                {tc("estimate")})
              </span>
            </span>,
            "ad",
            ad.id,
          );
        }),
      )}
      {section(
        t("sectionShops"),
        contents.shops.map((s) =>
          row(
            s.id,
            linkInApp ? (
              <Link href={`/app/shops/${s.domain}`} className="underline-offset-2 hover:underline">
                {s.name ?? s.domain}
              </Link>
            ) : (
              <a
                href={`https://${s.domain}`}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline-offset-2 hover:underline"
              >
                {s.name ?? s.domain}
              </a>
            ),
            <span className="flex flex-wrap gap-x-2">
              <span>{s.domain}</span>
              {s.country && <span>{s.country}</span>}
              {s.niche && <span>{s.niche}</span>}
              <span>
                {formatMoneyRange(s.est_monthly_revenue_low, s.est_monthly_revenue_high, locale) ??
                  "–"}{" "}
                / {tc("perMonth")} ({tc("estimate")})
              </span>
            </span>,
            "shop",
            s.id,
          ),
        ),
      )}
      {section(
        t("sectionEmails"),
        contents.emails.map((e) =>
          row(
            e.id,
            linkInApp ? (
              <Link href={`/app/emails/${e.id}`} className="underline-offset-2 hover:underline">
                {e.subject ?? "–"}
              </Link>
            ) : (
              (e.subject ?? "–")
            ),
            <span className="flex flex-wrap items-center gap-x-2">
              <span>{e.shops.name ?? e.shops.domain}</span>
              <Badge tone="outline">{te(`types.${e.type}`)}</Badge>
              <span>{formatDate(e.received_at, locale)}</span>
              {e.preheader && <span className="basis-full">{e.preheader}</span>}
            </span>,
            "email",
            e.id,
          ),
        ),
      )}
    </div>
  );
}
