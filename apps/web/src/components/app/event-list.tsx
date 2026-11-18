import type { ShopEventRow } from "@trendtrack/db";
import { Mail, Megaphone, PackageMinus, PackagePlus, Tag, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDate, formatMoney } from "@/lib/format";

const ICONS: Record<string, LucideIcon> = {
  new_ad: Megaphone,
  stopped_ad: Megaphone,
  new_product: PackagePlus,
  removed_product: PackageMinus,
  price_change: Tag,
  new_email: Mail,
};

type Payload = Record<string, string | number | boolean | null | undefined>;

/** Lijst met veranderingen bij shops (Brandtracker-feed, prijswijzigingen). */
export async function EventList({
  events,
  showShop = true,
}: {
  events: ShopEventRow[];
  showShop?: boolean;
}) {
  const [t, tc, locale] = await Promise.all([
    getTranslations("events"),
    getTranslations("common"),
    getLocale(),
  ]);
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
      {events.map((e) => {
        const p = (e.payload ?? {}) as Payload;
        const Icon = ICONS[e.type] ?? Tag;
        const title = String(p.title ?? p.subject ?? p.external_id ?? t("untitled"));
        const detail =
          e.type === "price_change" && typeof p.from === "number" && typeof p.to === "number"
            ? t("priceFromTo", { from: formatMoney(p.from, locale), to: formatMoney(p.to, locale) })
            : e.type === "stopped_ad" && typeof p.run_days === "number"
              ? t("ranDays", { days: tc("days", { count: p.run_days }) })
              : e.type === "new_product" && typeof p.price === "number"
                ? formatMoney(p.price, locale)
                : null;
        const href =
          e.ref_id && (e.type === "new_ad" || e.type === "stopped_ad")
            ? `/app/ads?ad=${e.ref_id}`
            : e.ref_id && e.type === "new_email"
              ? `/app/emails/${e.ref_id}`
              : null;
        return (
          <li key={e.id} className="flex items-start gap-3 px-4 py-3 text-sm">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-medium">{t(e.type as "new_ad")}</span>
                <span className="text-muted-foreground"> · </span>
                {href ? (
                  <Link href={href} className="underline-offset-2 hover:underline">
                    {title}
                  </Link>
                ) : (
                  title
                )}
                {detail && <span className="text-muted-foreground tabular"> · {detail}</span>}
              </p>
              {showShop && (
                <Link
                  href={`/app/shops/${e.shops.domain}`}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {e.shops.name ?? e.shops.domain}
                </Link>
              )}
            </div>
            <time dateTime={e.occurred_at} className="shrink-0 text-xs text-muted-foreground">
              {formatDate(e.occurred_at, locale)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
