import {
  APP_SIGNATURES,
  parseFilters,
  ShopFiltersSchema,
  toQueryString,
  type ShopFilters,
} from "@trendtrack/core";
import { getShopFacets, listShops } from "@trendtrack/db";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EstimateRange } from "@/components/app/estimate";
import { Growth } from "@/components/app/growth";
import { Pagination } from "@/components/app/pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader, ShopAvatar } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { getSession } from "@/lib/server/session";

const DEFAULTS = { sort: "growth", page: 1, per_page: 25 };
const href = (f: Partial<ShopFilters>) => `/app/shops${toQueryString(f, DEFAULTS)}`;

export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // Het filterformulier stuurt ook lege velden mee; maak de URL schoon zodat hij deelbaar blijft.
  if (Object.values(raw).some((v) => v === ""))
    redirect(href(parseFilters(ShopFiltersSchema, raw)));
  const filters = parseFilters(ShopFiltersSchema, raw);
  const { db } = await getSession();
  const [t, tc, locale, result, facets] = await Promise.all([
    getTranslations("shops"),
    getTranslations("common"),
    getLocale(),
    listShops(db, filters),
    getShopFacets(db),
  ]);

  const sortHeader = (
    column: ShopFilters["sort"],
    label: string,
    align: "left" | "right" = "left",
  ) => {
    const active = filters.sort === column;
    const defaultAsc = column === "name";
    const asc = active ? (filters.order ? filters.order === "asc" : defaultAsc) : defaultAsc;
    const nextOrder = active ? (asc ? "desc" : "asc") : undefined;
    return (
      <th
        scope="col"
        className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}
        aria-sort={active ? (asc ? "ascending" : "descending") : undefined}
      >
        <Link
          href={href({ ...filters, sort: column, order: nextOrder, page: 1 })}
          className="inline-flex items-center gap-1 hover:text-foreground"
          title={t("sortBy", { column: label })}
        >
          {label}
          {active &&
            (asc ? (
              <ArrowUp className="size-3" aria-hidden />
            ) : (
              <ArrowDown className="size-3" aria-hidden />
            ))}
        </Link>
      </th>
    );
  };

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <form
        method="get"
        className="mb-5 grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4 xl:grid-cols-6"
      >
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {filters.sort !== "growth" && <input type="hidden" name="sort" value={filters.sort} />}
        <Field label={t("country")} htmlFor="f-country">
          <Select id="f-country" name="country" defaultValue={filters.country ?? ""}>
            <option value="">{tc("all")}</option>
            {facets.countries.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("niche")} htmlFor="f-niche">
          <Select id="f-niche" name="niche" defaultValue={filters.niche ?? ""}>
            <option value="">{tc("all")}</option>
            {facets.niches.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("theme")} htmlFor="f-theme">
          <Select id="f-theme" name="theme" defaultValue={filters.theme ?? ""}>
            <option value="">{tc("all")}</option>
            {facets.themes.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("app")} htmlFor="f-app">
          <Select id="f-app" name="app" defaultValue={filters.app ?? ""}>
            <option value="">{tc("all")}</option>
            {[...APP_SIGNATURES]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label={t("revenueMin")} htmlFor="f-rev-min">
          <Input
            id="f-rev-min"
            name="revenue_min"
            type="number"
            min={0}
            step="any"
            inputMode="numeric"
            defaultValue={filters.revenue_min ?? ""}
          />
        </Field>
        <Field label={t("revenueMax")} htmlFor="f-rev-max">
          <Input
            id="f-rev-max"
            name="revenue_max"
            type="number"
            min={0}
            step="any"
            inputMode="numeric"
            defaultValue={filters.revenue_max ?? ""}
          />
        </Field>
        <Field label={t("adsMin")} htmlFor="f-ads">
          <Input
            id="f-ads"
            name="ads_min"
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={filters.ads_min ?? ""}
          />
        </Field>
        <Field label={t("growthMin")} htmlFor="f-growth">
          <Input
            id="f-growth"
            name="growth_min"
            type="number"
            min={-1}
            max={1}
            step="any"
            defaultValue={filters.growth_min ?? ""}
          />
        </Field>
        <Field label={t("firstSeenAfter")} htmlFor="f-seen">
          <Input
            id="f-seen"
            name="first_seen_after"
            type="date"
            defaultValue={filters.first_seen_after ?? ""}
          />
        </Field>
        <div className="col-span-2 flex items-end gap-2 md:col-span-3">
          <Button type="submit">{tc("filter")}</Button>
          <Link href="/app/shops" className={buttonVariants({ variant: "ghost" })}>
            {tc("reset")}
          </Link>
          <span className="ml-auto self-center text-sm text-muted-foreground" role="status">
            {filters.q ? `“${filters.q}” · ` : ""}
            {tc("results", { count: result.total })}
          </span>
        </div>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")}>{t("emptyBody")}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                {sortHeader("name", t("shop"))}
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("country")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("niche")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("theme")}
                </th>
                {sortHeader("revenue", t("revenue"), "right")}
                {sortHeader("ads", t("activeAds"), "right")}
                {sortHeader("growth", t("growth"), "right")}
                {sortHeader("newest", t("firstSeen"), "right")}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2.5">
                    <Link href={`/app/shops/${s.domain}`} className="flex items-center gap-2.5">
                      <ShopAvatar name={s.name ?? s.domain} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.name ?? s.domain}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {s.domain}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{s.country ?? "–"}</td>
                  <td className="px-3 py-2.5">{s.niche ?? "–"}</td>
                  <td className="px-3 py-2.5">{s.theme_name ?? "–"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <EstimateRange
                      low={s.est_monthly_revenue_low}
                      high={s.est_monthly_revenue_high}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">{s.active_ads_count}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Growth score={s.growth_score} locale={locale} />
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground">
                    {formatDate(s.first_seen_at, locale)}
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
