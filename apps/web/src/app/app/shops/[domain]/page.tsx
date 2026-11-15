import { APP_SIGNATURES, tryNormalizeDomain } from "@trendtrack/core";
import { AdFiltersSchema, EmailFiltersSchema, parseFilters } from "@trendtrack/core";
import {
  getLatestLookup,
  getShopByDomain,
  getShopSnapshots,
  isTracked,
  listAds,
  listEmails,
  listFolders,
  listShopBestsellers,
  listShopEvents,
  listShopProducts,
  type ShopDetail,
} from "@trendtrack/db";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { fetchShopAction } from "@/app/app/actions";
import { AdCard } from "@/components/app/ad-card";
import { EstimateCard } from "@/components/app/estimate";
import { EventList } from "@/components/app/event-list";
import { FollowButton } from "@/components/app/follow-button";
import { Growth } from "@/components/app/growth";
import { LookupPending } from "@/components/app/lookup-status";
import { SaveToFolder } from "@/components/app/save-to-folder";
import { TrendChart } from "@/components/app/trend-chart";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, Card, EmptyState, ShopAvatar } from "@/components/ui/misc";
import { formatDate, formatMoney, formatNumberRange } from "@/lib/format";
import { getSession } from "@/lib/server/session";
import { cn } from "@/lib/utils";

const TABS = ["overview", "products", "ads", "emails", "tech"] as const;
type Tab = (typeof TABS)[number];

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const domain = tryNormalizeDomain(decodeURIComponent((await params).domain));
  if (!domain) notFound();
  const tabParam = (await searchParams).tab;
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "overview";

  const { db, workspace } = await getSession();
  const shop = await getShopByDomain(db, domain);
  if (!shop) return <UnknownShop domain={domain} workspaceId={workspace.id} />;

  const [t, locale, tracked, folders] = await Promise.all([
    getTranslations("shop"),
    getLocale(),
    isTracked(db, workspace.id, shop.id),
    listFolders(db, workspace.id),
  ]);
  const path = `/app/shops/${shop.domain}`;
  const name = shop.name ?? shop.domain;

  return (
    <>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <ShopAvatar name={name} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <a
                href={`https://${shop.domain}`}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 hover:text-foreground"
                title={t("visit")}
              >
                {shop.domain}
                <ExternalLink className="size-3" aria-hidden />
              </a>
              {shop.country && <Badge tone="outline">{shop.country}</Badge>}
              {shop.niche && <Badge tone="outline">{shop.niche}</Badge>}
              {shop.theme_name && <Badge tone="outline">{shop.theme_name}</Badge>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FollowButton shopId={shop.id} tracked={tracked} path={path} />
          <SaveToFolder
            itemType="shop"
            itemId={shop.id}
            folders={folders.map((f) => ({ id: f.id, name: f.name }))}
          />
        </div>
      </header>

      {shop.status !== "active" && (
        <p
          role="status"
          className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          {shop.status === "blocked" ? t("statusBlocked") : t("statusDead")}
        </p>
      )}
      {shop.platform !== "shopify" && shop.status === "active" && (
        <p
          role="status"
          className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          {t("notShopify")}
        </p>
      )}

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border" aria-label="Tabs">
        {TABS.map((key) => (
          <Link
            key={key}
            href={key === "overview" ? path : `${path}?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
              tab === key
                ? "border-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            scroll={false}
          >
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <Overview shop={shop} locale={locale} />}
      {tab === "products" && <Products shop={shop} locale={locale} />}
      {tab === "ads" && <Ads shop={shop} />}
      {tab === "emails" && <Emails shop={shop} locale={locale} />}
      {tab === "tech" && <Tech shop={shop} />}

      {shop.last_crawled_at && (
        <p className="mt-8 text-xs text-muted-foreground">
          {t("lastCrawled", { date: formatDate(shop.last_crawled_at, locale, "long") })}
        </p>
      )}
    </>
  );
}

async function Overview({ shop, locale }: { shop: ShopDetail; locale: string }) {
  const { db } = await getSession();
  const [t, tc, ts, snapshots, products] = await Promise.all([
    getTranslations("shop"),
    getTranslations("common"),
    getTranslations("shops"),
    getShopSnapshots(db, shop.id, 90),
    listShopProducts(db, shop.id, { limit: 1 }),
  ]);
  const signals = Object.keys((shop.est_signals ?? {}) as Record<string, number>);
  const orders = formatNumberRange(
    shop.est_monthly_orders_low,
    shop.est_monthly_orders_high,
    locale,
  );
  const revenue = snapshots.map((s) => ({
    date: s.captured_on,
    value: s.est_daily_revenue,
    low: s.est_daily_revenue_low,
    high: s.est_daily_revenue_high,
  }));
  const ads = snapshots.map((s) => ({ date: s.captured_on, value: s.active_ads_count }));
  const hasHistory =
    revenue.filter((p) => p.value !== null).length >= 2 ||
    ads.filter((p) => p.value !== null).length >= 2;

  return (
    <div className="space-y-5">
      <EstimateCard
        low={shop.est_monthly_revenue_low}
        mid={shop.est_monthly_revenue}
        high={shop.est_monthly_revenue_high}
        confidence={shop.est_confidence}
        signals={signals}
      />
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`${t("orders")} (${tc("estimate")})`} value={orders ?? "–"} />
        <Stat label={ts("activeAds")} value={String(shop.active_ads_count)} />
        <Stat label={ts("growth")} value={<Growth score={shop.growth_score} locale={locale} />} />
        <Stat label={t("products")} value={String(products.total)} />
      </dl>
      {hasHistory ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <TrendChart
            title={t("revenueOverTime")}
            points={revenue}
            locale={locale}
            kind="currency"
            bandLabel={tc("estimate")}
            tableLabel={tc("table")}
            dateLabel={tc("date")}
          />
          <TrendChart
            title={t("adsOverTime")}
            points={ads}
            locale={locale}
            kind="count"
            tableLabel={tc("table")}
            dateLabel={tc("date")}
          />
        </div>
      ) : (
        <EmptyState title={t("revenueOverTime")}>{t("noHistory")}</EmptyState>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular">{value}</dd>
    </Card>
  );
}

async function Products({ shop, locale }: { shop: ShopDetail; locale: string }) {
  const { db } = await getSession();
  const [t, bestsellers, newest, priceChanges] = await Promise.all([
    getTranslations("shop"),
    listShopBestsellers(db, shop.id, 8),
    listShopProducts(db, shop.id, { sort: "newest", limit: 12 }),
    listShopEvents(db, [shop.id], { types: ["price_change"], limit: 20 }),
  ]);
  if (newest.total === 0)
    return <EmptyState title={t("tabs.products")}>{t("productsEmpty")}</EmptyState>;

  const card = (
    p: {
      id: string;
      title: string;
      handle: string | null;
      price_min: number | null;
      compare_at_price: number | null;
      product_type: string | null;
    },
    extra?: string,
  ) => (
    <li key={p.id} className="rounded-lg border border-border bg-card p-3 text-sm">
      {extra && <p className="mb-1 text-xs text-muted-foreground">{extra}</p>}
      <a
        href={p.handle ? `https://${shop.domain}/products/${p.handle}` : `https://${shop.domain}`}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="line-clamp-2 font-medium underline-offset-2 hover:underline"
      >
        {p.title}
      </a>
      <p className="mt-1 tabular">
        {formatMoney(p.price_min, locale)}{" "}
        {p.compare_at_price && p.price_min && p.compare_at_price > p.price_min && (
          <s className="text-muted-foreground">{formatMoney(p.compare_at_price, locale)}</s>
        )}
      </p>
      {p.product_type && <p className="mt-1 text-xs text-muted-foreground">{p.product_type}</p>}
    </li>
  );

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-medium">{t("bestsellers")}</h2>
        {bestsellers.rows.length ? (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {bestsellers.rows.map((p) => card(p, t("position", { position: p.position })))}
          </ul>
        ) : (
          <p className="max-w-2xl text-sm text-muted-foreground">{t("bestsellersEmpty")}</p>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-medium">{t("newest")}</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {newest.rows.map((p) => card(p, formatDate(p.published_at ?? p.first_seen_at, locale)))}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 font-medium">{t("priceChanges")}</h2>
        {priceChanges.length ? (
          <EventList events={priceChanges} showShop={false} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("priceChangesEmpty")}</p>
        )}
      </section>
    </div>
  );
}

async function Ads({ shop }: { shop: ShopDetail }) {
  const { db } = await getSession();
  const [t, result] = await Promise.all([
    getTranslations("shop"),
    listAds(db, parseFilters(AdFiltersSchema, { domain: shop.domain, per_page: "12" })),
  ]);
  if (result.rows.length === 0)
    return <EmptyState title={t("tabs.ads")}>{t("adsEmpty")}</EmptyState>;
  return (
    <div className="space-y-4">
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {result.rows.map((ad) => (
          <li key={ad.id} className="flex">
            <AdCard ad={ad} href={`/app/ads?domain=${shop.domain}&ad=${ad.id}`} />
          </li>
        ))}
      </ul>
      {result.total > result.rows.length && (
        <Link
          href={`/app/ads?domain=${shop.domain}`}
          className={buttonVariants({ variant: "outline" })}
        >
          {t("allAds")} ({result.total})
        </Link>
      )}
    </div>
  );
}

async function Emails({ shop, locale }: { shop: ShopDetail; locale: string }) {
  const { db } = await getSession();
  const [t, te, result] = await Promise.all([
    getTranslations("shop"),
    getTranslations("emails"),
    listEmails(db, parseFilters(EmailFiltersSchema, { domain: shop.domain, per_page: "100" })),
  ]);
  if (result.rows.length === 0)
    return <EmptyState title={t("tabs.emails")}>{t("emailsEmpty")}</EmptyState>;
  return (
    <ol className="relative ml-2 space-y-4 border-l border-border pl-5">
      {result.rows.map((e) => (
        <li key={e.id} className="relative">
          <span
            aria-hidden
            className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-muted-foreground"
          />
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <time dateTime={e.received_at}>{formatDate(e.received_at, locale, "long")}</time>
            <Badge tone={e.type === "campaign" ? "outline" : "neutral"}>
              {te(`types.${e.type}`)}
            </Badge>
            {e.flow_step && <span>{te("step", { step: e.flow_step })}</span>}
          </p>
          <Link
            href={`/app/emails/${e.id}`}
            className="mt-0.5 block font-medium underline-offset-2 hover:underline"
          >
            {e.subject ?? "–"}
          </Link>
          {e.preheader && <p className="text-sm text-muted-foreground">{e.preheader}</p>}
        </li>
      ))}
    </ol>
  );
}

async function Tech({ shop }: { shop: ShopDetail }) {
  const t = await getTranslations("shop");
  const ids = Array.isArray(shop.apps)
    ? (shop.apps as unknown[]).filter((a): a is string => typeof a === "string")
    : [];
  const known = new Map(APP_SIGNATURES.map((a) => [a.id, a]));
  const byCategory = new Map<string, string[]>();
  for (const id of ids) {
    const app = known.get(id);
    const cat = app?.category ?? "other";
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), app?.name ?? id]);
  }
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-4">
        <h2 className="text-xs text-muted-foreground">{t("techTheme")}</h2>
        <p className="mt-1 text-lg font-semibold">{shop.theme_name ?? "–"}</p>
        <p className="mt-1 text-xs text-muted-foreground capitalize">{shop.platform ?? ""}</p>
      </Card>
      <Card className="p-4 md:col-span-2">
        <h2 className="text-xs text-muted-foreground">
          {t("techApps")} ({ids.length})
        </h2>
        {ids.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("techEmpty")}</p>
        ) : (
          <dl className="mt-2 space-y-2 text-sm">
            {[...byCategory]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([cat, names]) => (
                <div key={cat} className="flex flex-wrap items-baseline gap-2">
                  <dt className="w-28 shrink-0 text-xs text-muted-foreground capitalize">
                    {cat.replace("-", " ")}
                  </dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {names.sort().map((n) => (
                      <Badge key={n}>{n}</Badge>
                    ))}
                  </dd>
                </div>
              ))}
          </dl>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("techNote")}</p>
      </Card>
    </div>
  );
}

async function UnknownShop({ domain, workspaceId }: { domain: string; workspaceId: string }) {
  const { db } = await getSession();
  const [t, lookup] = await Promise.all([
    getTranslations("lookup"),
    getLatestLookup(db, workspaceId, domain),
  ]);
  const fetchForm = (label: string) => (
    <form action={fetchShopAction}>
      <input type="hidden" name="domain" value={domain} />
      <Button type="submit">{label}</Button>
    </form>
  );

  if (!lookup)
    return (
      <EmptyState title={t("unknownTitle", { domain })} action={fetchForm(t("fetch"))}>
        {t("unknownBody")}
      </EmptyState>
    );
  if (lookup.status === "queued" || lookup.status === "processing") {
    return (
      <LookupPending
        title={t(lookup.status, { domain })}
        body={t(`${lookup.status}Body`)}
        note={lookup.error ? t("retrying") : null}
      />
    );
  }
  // "done" maar de shop is er (nog) niet: behandel als mislukt.
  const status =
    lookup.status === "done"
      ? "failed"
      : (lookup.status as "not_shopify" | "blocked" | "dead" | "failed");
  return (
    <EmptyState
      title={t(status, { domain })}
      action={status === "failed" || status === "dead" ? fetchForm(t("retry")) : undefined}
    >
      {t(`${status}Body`)}
    </EmptyState>
  );
}
