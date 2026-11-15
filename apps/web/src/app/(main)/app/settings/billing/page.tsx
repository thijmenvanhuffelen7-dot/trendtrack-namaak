import {
  INTERVAL_DISCOUNT,
  INTERVALS,
  PAID_PLANS,
  PLANS,
  quote,
  type BillingInterval,
  type PlanId,
  type UsageResult,
} from "@trendtrack/core";
import { getUsageSummary } from "@trendtrack/db";
import { Check } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { formatDate, formatMoney } from "@/lib/format";
import { stripeConfigured } from "@/lib/server/billing/stripe";
import { serviceDb } from "@/lib/server/db";
import { getPlan, getSession } from "@/lib/server/session";
import { cn } from "@/lib/utils";
import { checkoutAction, portalAction } from "./actions";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string; checkout?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const interval: BillingInterval = INTERVALS.includes(sp.interval as BillingInterval)
    ? (sp.interval as BillingInterval)
    : "month";
  const { workspace } = await getSession();
  const [t, locale, plan, summary, ws] = await Promise.all([
    getTranslations("billing"),
    getLocale(),
    getPlan(),
    getUsageSummary(serviceDb(), workspace.id),
    serviceDb().from("workspaces").select("stripe_customer_id").eq("id", workspace.id).single(),
  ]);
  const configured = stripeConfigured();
  const sub = plan.subscription;
  const paid = sub && sub.provider !== "manual";
  const trialDays = plan.trialEndsAt
    ? Math.max(0, Math.ceil((Date.parse(plan.trialEndsAt) - Date.now()) / 86_400_000))
    : null;
  const status = sub ? sub.status : "free";
  const cents = (c: number) => formatMoney(c / 100, locale);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      {sp.checkout === "success" && <Notice tone="positive">{t("checkoutSuccess")}</Notice>}
      {sp.checkout === "cancel" && <Notice>{t("checkoutCancel")}</Notice>}
      {sp.error && (
        <Notice tone="danger">{sp.error === "config" ? t("notConfigured") : t("error")}</Notice>
      )}
      {!configured && !sp.error && <Notice>{t("notConfigured")}</Notice>}

      <div className="mb-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("current")}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold">{PLANS[plan.plan].name}</h2>
            <Badge
              tone={
                status === "past_due" ? "warning" : status === "active" ? "positive" : "neutral"
              }
            >
              {t(`status.${status}`)}
            </Badge>
            {plan.plan === "agency" && (
              <Badge tone="outline">{t("seats", { count: plan.seats })}</Badge>
            )}
          </div>
          {trialDays !== null && (
            <div className="mt-3 text-sm">
              <p className="font-medium">{t("trialLeft", { count: trialDays })}</p>
              <p className="mt-1 text-muted-foreground">{t("trialBody")}</p>
            </div>
          )}
          {status === "past_due" && <p className="mt-3 text-sm text-warning">{t("pastDue")}</p>}
          {paid && sub.current_period_end && (
            <p className="mt-3 text-sm text-muted-foreground">
              {sub.cancel_at_period_end
                ? t("cancelsAt", { date: formatDate(sub.current_period_end, locale, "long") })
                : t("renewsAt", { date: formatDate(sub.current_period_end, locale, "long") })}
            </p>
          )}
          {ws.data?.stripe_customer_id && configured && (
            <form action={portalAction} className="mt-4">
              <Button type="submit" variant="outline">
                {t("manage")}
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">{t("manageHint")}</p>
            </form>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm text-muted-foreground">{t("usage")}</h2>
          <ul className="mt-3 space-y-3">
            {summary.usage.map((u) => (
              <UsageRow
                key={u.action}
                u={u}
                label={t(`usageLabels.${u.action}`)}
                unlimited={t("unlimited")}
                notIncluded={t("notIncluded")}
                resets={u.resetsAt ? t("resets", { date: formatDate(u.resetsAt, locale) }) : null}
              />
            ))}
          </ul>
        </Card>
      </div>

      <section aria-labelledby="plans-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="plans-title" className="text-lg font-semibold">
            {t("plans")}
          </h2>
          <nav
            className="inline-flex rounded-md border border-border p-0.5"
            aria-label={t("plans")}
          >
            {INTERVALS.map((i) => (
              <Link
                key={i}
                href={
                  i === "month" ? "/app/settings/billing" : `/app/settings/billing?interval=${i}`
                }
                aria-current={interval === i ? "page" : undefined}
                scroll={false}
                className={cn(
                  "rounded px-3 py-1 text-sm",
                  interval === i
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`interval.${i}`)}
                {INTERVAL_DISCOUNT[i] > 0 && (
                  <span className="ml-1 text-xs opacity-80">
                    {t("discount", { percent: INTERVAL_DISCOUNT[i] * 100 })}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PlanCard id="free" interval={interval} current={plan.plan === "free"}>
            {plan.plan === "free" && <p className="text-sm font-medium">{t("currentPlan")}</p>}
          </PlanCard>
          {PAID_PLANS.map((id) => {
            const q = quote(id, interval);
            const isCurrent = plan.plan === id && !!paid;
            return (
              <PlanCard
                key={id}
                id={id}
                interval={interval}
                current={isCurrent}
                price={`${cents(q.perMonthCents)}`}
                billed={
                  interval !== "month"
                    ? t("billedAs", {
                        amount: cents(q.totalCents),
                        period: t(`periodName.${interval}`),
                      })
                    : null
                }
              >
                {isCurrent ? (
                  <p className="text-sm font-medium">{t("currentPlan")}</p>
                ) : (
                  <form action={checkoutAction} className="space-y-2">
                    <input type="hidden" name="plan" value={id} />
                    <input type="hidden" name="interval" value={interval} />
                    {id === "agency" && !paid && (
                      <label className="block text-xs text-muted-foreground">
                        {t("extraSeats")}
                        <Input
                          name="seats"
                          type="number"
                          min={3}
                          max={200}
                          defaultValue={3}
                          className="mt-1"
                        />
                      </label>
                    )}
                    <Button
                      type="submit"
                      className="w-full"
                      variant={id === "pro" ? "default" : "outline"}
                      disabled={!configured}
                    >
                      {paid ? t("switchInPortal") : t("choose", { plan: PLANS[id].name })}
                    </Button>
                  </form>
                )}
              </PlanCard>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">{t("vat")}</p>
      </section>
    </>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone?: "positive" | "danger" }) {
  return (
    <p
      role="status"
      className={cn(
        "mb-5 rounded-md border border-border px-3 py-2 text-sm",
        tone === "positive" && "border-positive/40 text-positive",
        tone === "danger" && "border-danger/40 text-danger",
        !tone && "bg-muted",
      )}
    >
      {children}
    </p>
  );
}

function UsageRow({
  u,
  label,
  unlimited,
  notIncluded,
  resets,
}: {
  u: UsageResult;
  label: string;
  unlimited: string;
  notIncluded: string;
  resets: string | null;
}) {
  const pct = u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
  return (
    <li className="text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span>{label}</span>
        <span className="tabular text-muted-foreground">
          {u.limit === null
            ? `${u.used} · ${unlimited}`
            : u.limit === 0
              ? notIncluded
              : `${u.used} / ${u.limit}`}
        </span>
      </div>
      {u.limit !== null && u.limit > 0 && (
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={u.used}
          aria-valuemin={0}
          aria-valuemax={u.limit}
          aria-label={label}
        >
          <div
            className={cn(
              "h-full rounded-full",
              pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-[var(--series-1)]",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {resets && u.limit !== null && u.limit > 0 && (
        <p className="mt-0.5 text-xs text-muted-foreground">{resets}</p>
      )}
    </li>
  );
}

async function PlanCard({
  id,
  current,
  price,
  billed,
  children,
}: {
  id: PlanId;
  interval: BillingInterval;
  current: boolean;
  price?: string;
  billed?: string | null;
  children: React.ReactNode;
}) {
  const t = await getTranslations("billing");
  const l = PLANS[id].limits;
  const n = (v: number | null) => (v === null ? -1 : v);
  const features = [
    t("features.lookups", { count: n(l.shopLookupsPerWeek) }),
    t("features.adSearches", { count: n(l.adSearchesPerDay) }),
    t("features.folders", { count: n(l.folders) }),
    t("features.tracked", { count: l.trackedBrands }),
    t("features.emails", { count: n(l.emailHistoryDays) }),
    l.api
      ? t("features.api", { count: (l.apiCallsPerMonth ?? 0).toLocaleString("nl-NL") })
      : t("features.noApi"),
    t("features.seats", { count: l.seats }),
  ];
  return (
    <li
      className={cn(
        "flex flex-col rounded-lg border bg-card p-5",
        current ? "border-foreground" : "border-border",
        id === "pro" && !current && "border-[var(--series-1)]",
      )}
    >
      <h3 className="font-semibold">{PLANS[id].name}</h3>
      <p className="mt-2 text-2xl font-semibold tabular">
        {price ?? "€ 0"}{" "}
        <span className="text-sm font-normal text-muted-foreground">{t("perMonth")}</span>
      </p>
      <p className="h-5 text-xs text-muted-foreground">{billed}</p>
      <ul className="mt-4 mb-5 space-y-1.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-auto">{children}</div>
    </li>
  );
}
