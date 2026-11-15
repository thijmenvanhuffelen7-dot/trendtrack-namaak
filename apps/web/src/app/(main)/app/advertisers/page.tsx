import {
  AdvertiserFiltersSchema,
  parseFilters,
  toQueryString,
  type AdvertiserFilters,
} from "@trendtrack/core";
import { listAdvertisers } from "@trendtrack/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Pagination } from "@/components/app/pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatMoneyRange, formatNumber } from "@/lib/format";
import { getSession } from "@/lib/server/session";

const DEFAULTS = { sort: "active_ads", page: 1, per_page: 25 };
const href = (f: Partial<AdvertiserFilters>) => `/app/advertisers${toQueryString(f, DEFAULTS)}`;

export default async function AdvertisersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  if (Object.values(raw).some((v) => v === ""))
    redirect(href(parseFilters(AdvertiserFiltersSchema, raw)));
  const filters = parseFilters(AdvertiserFiltersSchema, raw);
  const { db } = await getSession();
  const [t, tc, locale, result] = await Promise.all([
    getTranslations("advertisers"),
    getTranslations("common"),
    getLocale(),
    listAdvertisers(db, filters),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <form
        method="get"
        className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
      >
        <Field label={t("name")} htmlFor="adv-q" className="w-64">
          <Input id="adv-q" name="q" type="search" defaultValue={filters.q ?? ""} />
        </Field>
        <Field label={tc("all")} htmlFor="adv-sort" className="w-52">
          <Select id="adv-sort" name="sort" defaultValue={filters.sort} aria-label="Sorteren">
            <option value="active_ads">{t("sortActive")}</option>
            <option value="reach">{t("sortReach")}</option>
          </Select>
        </Field>
        <Button type="submit">{tc("filter")}</Button>
        <Link href="/app/advertisers" className={buttonVariants({ variant: "ghost" })}>
          {tc("reset")}
        </Link>
        <span className="ml-auto self-center text-sm text-muted-foreground" role="status">
          {tc("results", { count: result.total })}
        </span>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")}>{t("emptyBody")}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("name")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("shop")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("activeAds")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("totalAds")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("reach")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("spend")} ({tc("estimate")})
                </th>
                <th scope="col" className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {result.rows.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-medium">{a.page_name ?? a.page_id}</td>
                  <td className="px-3 py-2.5">
                    {a.shop_domain ? (
                      <Link
                        href={`/app/shops/${a.shop_domain}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {a.shop_domain}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">{a.active_ads}</td>
                  <td className="px-3 py-2.5 text-right tabular text-muted-foreground">
                    {a.total_ads}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">
                    {formatNumber(Number(a.total_reach), locale, true)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular whitespace-nowrap">
                    {Number(a.est_spend_high) > 0
                      ? formatMoneyRange(Number(a.est_spend_low), Number(a.est_spend_high), locale)
                      : "–"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/app/ads?advertiser_id=${a.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      {t("viewAds")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        hrefFor={(page) => href({ ...filters, page })}
      />
    </>
  );
}
