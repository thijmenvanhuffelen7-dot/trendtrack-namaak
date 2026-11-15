import { PLANS } from "@trendtrack/core";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/misc";
import { getPlan, getSession } from "@/lib/server/session";
import { setLocaleAction } from "../actions";

export default async function SettingsPage() {
  const { user, workspace } = await getSession();
  const [t, locale, plan] = await Promise.all([
    getTranslations("settings"),
    getLocale(),
    getPlan(),
  ]);
  return (
    <>
      <PageHeader title={t("title")} />
      <div className="max-w-2xl space-y-4">
        <Link href="/app/settings/billing" className="block">
          <Card className="flex items-center gap-3 p-4 transition-colors hover:border-foreground/25">
            <div className="flex-1">
              <p className="font-medium">{t("billing")}</p>
              <p className="text-sm text-muted-foreground">
                {PLANS[plan.plan].name} · {t("billingHint")}
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Card>
        </Link>
        <Link href="/app/settings/password" className="block">
          <Card className="flex items-center gap-3 p-4 transition-colors hover:border-foreground/25">
            <div className="flex-1">
              <p className="font-medium">{t("password")}</p>
              <p className="text-sm text-muted-foreground">{t("passwordHint")}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Card>
        </Link>
        <Link href="/app/settings/affiliate" className="block">
          <Card className="flex items-center gap-3 p-4 transition-colors hover:border-foreground/25">
            <div className="flex-1">
              <p className="font-medium">{t("affiliate")}</p>
              <p className="text-sm text-muted-foreground">{t("affiliateHint")}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Card>
        </Link>
        <Card className="p-4">
          <p className="font-medium">{t("account")}</p>
          <dl className="mt-2 grid grid-cols-[140px_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t("email")}</dt>
            <dd>{user.email}</dd>
            <dt className="text-muted-foreground">{t("workspace")}</dt>
            <dd>{workspace.name}</dd>
          </dl>
        </Card>
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex-1">
            <p className="font-medium">{t("language")}</p>
            <p className="text-sm text-muted-foreground">{t("languageHint")}</p>
          </div>
          {(["nl", "en"] as const).map((l) => (
            <form key={l} action={setLocaleAction}>
              <input type="hidden" name="locale" value={l} />
              <Button
                type="submit"
                variant={locale === l ? "default" : "outline"}
                size="sm"
                aria-pressed={locale === l}
              >
                {l === "nl" ? "Nederlands" : "English"}
              </Button>
            </form>
          ))}
        </Card>
      </div>
    </>
  );
}
