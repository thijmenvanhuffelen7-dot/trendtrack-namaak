import {
  listShopEvents,
  listTrackedBrands,
  type ShopEventRow,
  type ShopEventType,
} from "@trendtrack/db";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { EstimateRange } from "@/components/app/estimate";
import { EventList } from "@/components/app/event-list";
import { FollowButton } from "@/components/app/follow-button";
import { Growth } from "@/components/app/growth";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader, ShopAvatar } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { getSession } from "@/lib/server/session";
import { cn } from "@/lib/utils";
import { toggleDigestAction } from "../folders/actions";

const TYPES: ShopEventType[] = ["new_ad", "stopped_ad", "new_product", "price_change", "new_email"];

export default async function BrandtrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const typeParam = (await searchParams).type;
  const type = TYPES.includes(typeParam as ShopEventType)
    ? (typeParam as ShopEventType)
    : undefined;
  const { db, workspace } = await getSession();
  const [t, te, ts, locale, tracked] = await Promise.all([
    getTranslations("brandtracker"),
    getTranslations("events"),
    getTranslations("shops"),
    getLocale(),
    listTrackedBrands(db, workspace.id),
  ]);

  if (tracked.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <EmptyState
          title={t("emptyTitle")}
          action={
            <Link href="/app/shops" className={buttonVariants()}>
              {t("browse")}
            </Link>
          }
        >
          {t("emptyBody")}
        </EmptyState>
      </>
    );
  }

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const events = await listShopEvents(
    db,
    tracked.map((b) => b.shops.id),
    { types: type ? [type] : TYPES, since, limit: 200 },
  );
  const groups = groupByDay(events);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="feed-title" className="min-w-0">
          <h2 id="feed-title" className="mb-3 font-medium">
            {t("feed")}
          </h2>
          <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Filter">
            {[undefined, ...TYPES].map((v) => (
              <Link
                key={v ?? "all"}
                href={v ? `/app/brandtracker?type=${v}` : "/app/brandtracker"}
                aria-current={type === v ? "page" : undefined}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-sm",
                  type === v
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {v ? te(v) : t("allTypes")}
              </Link>
            ))}
          </nav>
          {events.length === 0 ? (
            <EmptyState title={t("feedEmptyTitle")}>{t("feedEmptyBody")}</EmptyState>
          ) : (
            <div className="space-y-6">
              {groups.map(([day, list]) => (
                <div key={day}>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    {day === today
                      ? t("today")
                      : day === yesterday
                        ? t("yesterday")
                        : formatDate(day, locale, "long")}
                  </h3>
                  <EventList events={list} />
                </div>
              ))}
            </div>
          )}
        </section>

        <aside aria-labelledby="tracked-title">
          <h2 id="tracked-title" className="mb-3 font-medium">
            {t("tracked")} <span className="text-muted-foreground">({tracked.length})</span>
          </h2>
          <ul className="space-y-3">
            {tracked.map((b) => (
              <li key={b.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                <Link href={`/app/shops/${b.shops.domain}`} className="flex items-center gap-2.5">
                  <ShopAvatar name={b.shops.name ?? b.shops.domain} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {b.shops.name ?? b.shops.domain}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {b.shops.domain}
                    </span>
                  </span>
                </Link>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">{ts("revenue")}</dt>
                    <dd>
                      <EstimateRange
                        low={b.shops.est_monthly_revenue_low}
                        high={b.shops.est_monthly_revenue_high}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{ts("activeAds")}</dt>
                    <dd className="tabular">{b.shops.active_ads_count}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{ts("growth")}</dt>
                    <dd>
                      <Growth score={b.shops.growth_score} locale={locale} />
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <form action={toggleDigestAction}>
                    <input type="hidden" name="shop_id" value={b.shops.id} />
                    <input type="hidden" name="enabled" value={b.daily_digest ? "false" : "true"} />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      aria-pressed={b.daily_digest}
                      title={t("digestNote")}
                    >
                      {b.daily_digest ? t("digestOn") : t("digestOff")}
                    </Button>
                  </form>
                  <div className="ml-auto">
                    <FollowButton
                      shopId={b.shops.id}
                      tracked
                      path="/app/brandtracker"
                      variant="unfollow-ghost"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{t("digestNote")}</p>
        </aside>
      </div>
    </>
  );
}

/** Groepeert events per kalenderdag (Europe/Amsterdam), nieuwste dag eerst. */
function groupByDay(events: ShopEventRow[]): [string, ShopEventRow[]][] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" });
  const map = new Map<string, ShopEventRow[]>();
  for (const e of events) {
    const day = fmt.format(new Date(e.occurred_at));
    map.set(day, [...(map.get(day) ?? []), e]);
  }
  return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
}
