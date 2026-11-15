import { PLANS, type UsageResult } from "@trendtrack/core";
import { Lock } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

/** Upgrade-melding als een limiet bereikt is. Zegt wat er op is, wanneer het reset en wat je kunt doen. */
export async function LimitNotice({ result }: { result: UsageResult }) {
  const [t, locale] = await Promise.all([getTranslations("limits"), getLocale()]);
  const title =
    result.reason === "not_in_plan" ? t(`notInPlan.${result.action}`) : t(`title.${result.action}`);
  return (
    <div role="alert" className="rounded-lg border border-border bg-card px-6 py-10 text-center">
      <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-medium">{title}</p>
      {result.reason === "limit" && result.limit !== null && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {t("body", { used: result.used, limit: result.limit, plan: PLANS[result.plan].name })}
          {result.resetsAt && (
            <> {t("resets", { date: formatDate(result.resetsAt, locale, "long") })}</>
          )}
        </p>
      )}
      <Link href="/app/settings/billing" className={`${buttonVariants()} mt-4`}>
        {t("upgrade")}
      </Link>
    </div>
  );
}
