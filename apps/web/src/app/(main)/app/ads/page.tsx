import { AdFiltersSchema, parseFilters, toQueryString, type AdFilters } from "@trendtrack/core";
import {
  type AdRow,
  adRunDays,
  checkAndRecordUsage,
  getAd,
  listAds,
  listFolders,
} from "@trendtrack/db";
import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AdCard } from "@/components/app/ad-card";
import { Pagination } from "@/components/app/pagination";
import { SaveToFolder } from "@/components/app/save-to-folder";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDate, formatMoneyRange, formatNumber } from "@/lib/format";
import { LimitNotice } from "@/components/app/limit-notice";
import { serviceDb } from "@/lib/server/db";
import { getSession } from "@/lib/server/session";

const DEFAULTS = { sort: "newest", page: 1, per_page: 24 };
const href = (f: Partial<AdFilters>, ad?: string) => {
  const qs = toQueryString(f, DEFAULTS);
  return `/app/ads${qs}${ad ? `${qs ? "&" : "?"}ad=${ad}` : ""}`;
};

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const adId = typeof raw.ad === "string" && /^[0-9a-f-]{36}$/i.test(raw.ad) ? raw.ad : undefined;
  if (Object.values(raw).some((v) => v === ""))
    redirect(href(parseFilters(AdFiltersSchema, raw), adId));
  const filters = parseFilters(AdFiltersSchema, raw);

  const { db, workspace, user } = await getSession();
  // Elke nieuwe zoekopdracht telt; bladeren en een ad openen niet.
  const { page: _page, per_page: _perPage, ...searchKey } = filters;
  const usage = await checkAndRecordUsage(serviceDb(), workspace.id, "ad_search", {
    key: toQueryString(searchKey) || "?",
    userId: user.id,
  });
  const [t, tc, result, selected, folders] = await Promise.all([
    getTranslations("ads"),
    getTranslations("common"),
    usage.allowed
      ? listAds(db, filters)
      : Promise.resolve({ rows: [] as AdRow[], total: 0, page: 1, perPage: filters.per_page }),
    adId ? getAd(db, adId) : null,
    adId ? listFolders(db, workspace.id) : [],
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <form
        method="get"
        className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-4 xl:grid-cols-7"
      >
        {filters.domain && <input type="hidden" name="domain" value={filters.domain} />}
        {filters.advertiser_id && (
          <input type="hidden" name="advertiser_id" value={filters.advertiser_id} />
        )}
        <Field label={t("search")} htmlFor="a-q" className="col-span-2">
          <Input
            id="a-q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder="gratis verzending"
          />
        </Field>
        <Field label={t("status")} htmlFor="a-active">
          <Select
            id="a-active"
            name="active"
            defaultValue={filters.active === undefined ? "" : String(filters.active)}
          >
            <option value="">{tc("all")}</option>
            <option value="true">{tc("active")}</option>
            <option value="false">{tc("inactive")}</option>
          </Select>
        </Field>
        <Field label={t("countries")} htmlFor="a-country">
          <Select id="a-country" name="country" defaultValue={filters.country ?? ""}>
            <option value="">{tc("all")}</option>
            {["NL", "BE", "DE", "FR"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("language")} htmlFor="a-lang">
          <Select id="a-lang" name="language" defaultValue={filters.language ?? ""}>
            <option value="">{tc("all")}</option>
            {["nl", "fr", "en", "de"].map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("minDays")} htmlFor="a-days">
          <Input
            id="a-days"
            name="min_days"
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={filters.min_days ?? ""}
            placeholder="30"
          />
        </Field>
        <Field label={t("minReach")} htmlFor="a-reach">
          <Input
            id="a-reach"
            name="min_reach"
            type="number"
            min={0}
            step="any"
            inputMode="numeric"
            defaultValue={filters.min_reach ?? ""}
          />
        </Field>
        <Field label={t("mediaType")} htmlFor="a-media">
          <Select id="a-media" name="media_type" defaultValue={filters.media_type ?? ""}>
            <option value="">{tc("all")}</option>
            {(["image", "video", "carousel", "unknown"] as const).map((m) => (
              <option key={m} value={m}>
                {t(`media.${m}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("sort")} htmlFor="a-sort" className="xl:col-span-2">
          <Select id="a-sort" name="sort" defaultValue={filters.sort}>
            <option value="newest">{t("sortNewest")}</option>
            <option value="longest">{t("sortLongest")}</option>
            <option value="reach">{t("sortReach")}</option>
          </Select>
        </Field>
        <div className="col-span-2 flex items-end gap-2 md:col-span-4 xl:col-span-4">
          <Button type="submit">{tc("filter")}</Button>
          <Link href="/app/ads" className={buttonVariants({ variant: "ghost" })}>
            {tc("reset")}
          </Link>
          <span className="ml-auto self-center text-sm text-muted-foreground" role="status">
            {filters.domain ? `${filters.domain} · ` : ""}
            {tc("results", { count: result.total })}
          </span>
        </div>
      </form>

      {!usage.allowed ? (
        <LimitNotice result={usage} />
      ) : result.rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")}>{t("emptyBody")}</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.rows.map((ad) => (
            <li key={ad.id} className="flex">
              <AdCard ad={ad} href={href(filters, ad.id)} />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        hrefFor={(page) => href({ ...filters, page })}
      />

      {selected && (
        <AdPanel
          ad={selected}
          closeHref={href(filters)}
          folders={folders.map((f) => ({ id: f.id, name: f.name }))}
        />
      )}
    </>
  );
}

/** Detailpaneel rechts: cijfers, tekst, link naar de shop en de landingspagina ernaast. */
async function AdPanel({
  ad,
  closeHref,
  folders,
}: {
  ad: AdRow;
  closeHref: string;
  folders: { id: string; name: string }[];
}) {
  const [t, tc, locale] = await Promise.all([
    getTranslations("ads"),
    getTranslations("common"),
    getLocale(),
  ]);
  const days = adRunDays(ad);
  const landing = ad.landing_url ?? (ad.landing_domain ? `https://${ad.landing_domain}/` : null);
  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={t("detail")}
    >
      <Link
        href={closeHref}
        scroll={false}
        className="absolute inset-0 bg-black/40"
        aria-label={tc("close")}
      />
      <div className="relative flex h-full w-full max-w-5xl flex-col bg-background shadow-xl md:flex-row">
        <div className="flex w-full shrink-0 flex-col overflow-y-auto border-b border-border p-5 md:w-[380px] md:border-r md:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("advertiser")}</p>
              <p className="truncate font-semibold">{ad.advertisers?.page_name ?? tc("unknown")}</p>
            </div>
            <Link
              href={closeHref}
              scroll={false}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              aria-label={tc("close")}
            >
              <X className="size-4" aria-hidden />
            </Link>
          </div>
          <p className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone={ad.is_active ? "positive" : "outline"}>
              {ad.is_active ? tc("active") : tc("inactive")}
            </Badge>
            {ad.countries.map((c) => (
              <Badge key={c} tone="outline">
                {c}
              </Badge>
            ))}
            {ad.languages.length > 0 && (
              <Badge tone="neutral">
                {t("language")}: {ad.languages.map((l) => l.toUpperCase()).join(", ")}
              </Badge>
            )}
          </p>
          {ad.title && <h2 className="mt-4 font-medium">{ad.title}</h2>}
          <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
            {ad.body ?? t("noText")}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{t("started", { date: "" }).trim()}</dt>
              <dd className="font-medium">{formatDate(ad.started_at, locale, "long")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {(ad.is_active ? t("running", { days: "" }) : t("ran", { days: "" })).trim()}
              </dt>
              <dd className="font-medium tabular">
                {days === null ? "–" : tc("days", { count: days })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("reach")}</dt>
              <dd className="font-medium tabular">{formatNumber(ad.eu_total_reach, locale)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("spend")} ({tc("estimate")})
              </dt>
              <dd className="font-medium tabular">
                {formatMoneyRange(ad.est_spend_low, ad.est_spend_high, locale) ?? "–"}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-col gap-2">
            {ad.snapshot_url && (
              <a
                href={ad.snapshot_url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                {t("viewInLibrary")}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
            {ad.shops && (
              <Link
                href={`/app/shops/${ad.shops.domain}`}
                className={buttonVariants({ variant: "outline" })}
              >
                {t("viewShop")}: {ad.shops.name ?? ad.shops.domain}
              </Link>
            )}
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <SaveToFolder itemType="ad" itemId={ad.id} folders={folders} />
          </div>
        </div>

        <div className="flex min-h-[320px] flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-sm">
            <span className="truncate text-muted-foreground">
              {t("landing")}: {ad.landing_domain ?? "–"}
            </span>
            {landing && (
              <a
                href={landing}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex shrink-0 items-center gap-1 underline-offset-2 hover:underline"
              >
                {t("openLanding")}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
          {landing ? (
            <>
              {/* Zonder scripts en zonder referrer: de shop ziet niet wie er kijkt en kan niets in onze pagina doen. */}
              <iframe
                src={landing}
                title={t("landing")}
                sandbox=""
                referrerPolicy="no-referrer"
                loading="lazy"
                className="w-full flex-1 bg-white"
              />
              <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                {t("landingNote")}
              </p>
            </>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">{t("landingNote")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
