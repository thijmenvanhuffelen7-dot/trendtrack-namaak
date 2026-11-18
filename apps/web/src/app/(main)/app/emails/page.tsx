import {
  type EmailFilters,
  EmailFiltersSchema,
  parseFilters,
  PLANS,
  toQueryString,
} from "@trendtrack/core";
import { emailHistoryFloor, getShopFacets, listEmails } from "@trendtrack/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Pagination } from "@/components/app/pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { getPlan, getSession } from "@/lib/server/session";

const DEFAULTS = { page: 1, per_page: 24 };
const href = (f: Partial<EmailFilters>) => `/app/emails${toQueryString(f, DEFAULTS)}`;

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  if (Object.values(raw).some((v) => v === ""))
    redirect(href(parseFilters(EmailFiltersSchema, raw)));
  const filters = parseFilters(EmailFiltersSchema, raw);
  const { db } = await getSession();
  const { plan } = await getPlan();
  const floor = emailHistoryFloor(plan);
  const effective =
    floor && (!filters.since || filters.since < floor) ? { ...filters, since: floor } : filters;
  const tl = await getTranslations("limits");
  const [t, tc, ts, locale, result, facets] = await Promise.all([
    getTranslations("emails"),
    getTranslations("common"),
    getTranslations("shops"),
    getLocale(),
    listEmails(db, effective),
    getShopFacets(db),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {floor && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-border bg-muted px-3 py-2 text-sm"
        >
          {tl("emailHistory", { days: PLANS[plan].limits.emailHistoryDays ?? 0 })}{" "}
          <Link href="/app/settings/billing" className="font-medium underline underline-offset-2">
            {tl("upgrade")}
          </Link>
        </p>
      )}
      <form
        method="get"
        className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-4 xl:grid-cols-6"
      >
        <Field label={t("search")} htmlFor="e-q" className="col-span-2 md:col-span-1 xl:col-span-1">
          <Input id="e-q" name="q" type="search" defaultValue={filters.q ?? ""} />
        </Field>
        <Field label={t("type")} htmlFor="e-type">
          <Select id="e-type" name="type" defaultValue={filters.type ?? ""}>
            <option value="">{tc("all")}</option>
            {(["welcome", "flow", "campaign"] as const).map((v) => (
              <option key={v} value={v}>
                {t(`types.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("shop")} htmlFor="e-domain">
          <Input
            id="e-domain"
            name="domain"
            defaultValue={filters.domain ?? ""}
            placeholder="zilverzand.nl"
          />
        </Field>
        <Field label={ts("niche")} htmlFor="e-niche">
          <Select id="e-niche" name="niche" defaultValue={filters.niche ?? ""}>
            <option value="">{tc("all")}</option>
            {facets.niches.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("since")} htmlFor="e-since">
          <Input id="e-since" name="since" type="date" defaultValue={filters.since ?? ""} />
        </Field>
        <Field label={t("until")} htmlFor="e-until">
          <Input id="e-until" name="until" type="date" defaultValue={filters.until ?? ""} />
        </Field>
        <div className="col-span-2 flex items-end gap-2 md:col-span-4 xl:col-span-6">
          <Button type="submit">{tc("filter")}</Button>
          <Link href="/app/emails" className={buttonVariants({ variant: "ghost" })}>
            {tc("reset")}
          </Link>
          <span className="ml-auto self-center text-sm text-muted-foreground" role="status">
            {tc("results", { count: result.total })}
          </span>
        </div>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")}>{t("emptyBody")}</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {result.rows.map((e) => (
            <li key={e.id}>
              <Link
                href={`/app/emails/${e.id}`}
                className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/25"
              >
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {e.shops.name ?? e.shops.domain}
                  </span>
                  <Badge tone={e.type === "campaign" ? "outline" : "neutral"}>
                    {t(`types.${e.type}`)}
                  </Badge>
                  {e.flow_step && <span>{t("step", { step: e.flow_step })}</span>}
                </p>
                <p className="mt-2 font-medium">{e.subject ?? "–"}</p>
                {e.preheader && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{e.preheader}</p>
                )}
                <time
                  dateTime={e.received_at}
                  className="mt-auto pt-3 text-xs text-muted-foreground"
                >
                  {formatDate(e.received_at, locale, "long")}
                </time>
              </Link>
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
    </>
  );
}
