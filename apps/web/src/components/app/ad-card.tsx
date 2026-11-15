import { adRunDays, type AdRow } from "@trendtrack/db";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/misc";
import { formatDate, formatMoneyRange, formatNumber } from "@/lib/format";

/** Vanaf zoveel dagen noemen we een ad "lang lopend" (vaak een winnaar). */
export const WINNER_DAYS = 30;

/**
 * Ad-kaart. De Meta API geeft geen afbeeldingen of video's terug, dus de kaart toont de tekst en
 * de cijfers; de creative zelf staat achter "Bekijk in Meta Ad Library".
 */
export async function AdCard({ ad, href }: { ad: AdRow; href: string }) {
  const [t, tc, locale] = await Promise.all([
    getTranslations("ads"),
    getTranslations("common"),
    getLocale(),
  ]);
  const days = adRunDays(ad);
  const spend = formatMoneyRange(ad.est_spend_low, ad.est_spend_high, locale);
  return (
    <article className="flex flex-col rounded-lg border border-border bg-card transition-colors hover:border-foreground/25">
      <Link href={href} className="flex flex-1 flex-col p-4" scroll={false}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {ad.advertisers?.page_name ?? ad.landing_domain ?? tc("unknown")}
            </p>
            <p className="truncate text-xs text-muted-foreground">{ad.landing_domain ?? "–"}</p>
          </div>
          <Badge tone={ad.is_active ? "positive" : "outline"}>
            {ad.is_active ? tc("active") : tc("inactive")}
          </Badge>
        </div>
        {ad.title && <p className="mt-3 text-sm font-medium">{ad.title}</p>}
        <p className="mt-1 line-clamp-4 text-sm text-muted-foreground">{ad.body ?? t("noText")}</p>
        <dl className="mt-auto grid grid-cols-3 gap-2 pt-4 text-xs">
          <div>
            <dt className="text-muted-foreground">
              {ad.is_active ? t("running", { days: "" }).trim() : t("ran", { days: "" }).trim()}
            </dt>
            <dd className="font-medium tabular">
              {days === null ? "–" : tc("days", { count: days })}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("reach")}</dt>
            <dd className="font-medium tabular">{formatNumber(ad.eu_total_reach, locale, true)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t("spend")} ({tc("estimate")})
            </dt>
            <dd className="font-medium tabular">{spend ?? "–"}</dd>
          </div>
        </dl>
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {t("started", { date: formatDate(ad.started_at, locale) })}
          {days !== null && days >= WINNER_DAYS && <Badge tone="neutral">{t("winner")}</Badge>}
          {ad.countries.map((c) => (
            <Badge key={c} tone="outline">
              {c}
            </Badge>
          ))}
        </p>
      </Link>
    </article>
  );
}
