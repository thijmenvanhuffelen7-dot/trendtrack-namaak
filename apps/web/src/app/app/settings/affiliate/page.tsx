import { affiliateStats, getAffiliate } from "@trendtrack/db";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/misc";
import { serviceDb } from "@/lib/server/db";
import { getSession, siteUrl } from "@/lib/server/session";
import { createAffiliateAction } from "./actions";

export default async function AffiliatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { db, user } = await getSession();
  const t = await getTranslations("affiliate");
  const { error } = await searchParams;
  const aff = await getAffiliate(db, user.id);
  const stats = aff ? await affiliateStats(serviceDb(), aff.code) : null;
  const link = aff ? `${siteUrl(await headers())}/?ref=${aff.code}` : null;
  const suggestion =
    user.email
      .split("@")[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 30) || "partner";
  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <div className="max-w-2xl space-y-4">
        {aff && link && stats ? (
          <>
            <Card className="p-4">
              <p className="font-medium">{t("yourLink")}</p>
              <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm break-all select-all">
                {link}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("linkHint", { pct: aff.commission_pct })}
              </p>
            </Card>
            <Card className="p-4">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("signups")}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{stats.signups}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("paying")}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{stats.paying}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-muted-foreground">{t("payout")}</p>
            </Card>
          </>
        ) : (
          <Card className="p-4">
            <form action={createAffiliateAction} className="space-y-3">
              <label htmlFor="aff-code" className="block font-medium">
                {t("chooseCode")}
              </label>
              <input
                id="aff-code"
                name="code"
                defaultValue={suggestion}
                required
                pattern="[a-z0-9_\-]{3,40}"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
              <p className="text-sm text-muted-foreground">{t("codeHint")}</p>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {t(error === "taken" ? "errorTaken" : "errorInvalid")}
                </p>
              )}
              <Button type="submit">{t("create")}</Button>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
