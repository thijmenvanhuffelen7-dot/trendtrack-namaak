import { PLANS } from "@trendtrack/core";
import { checkAndRecordUsage, listApiKeys } from "@trendtrack/db";
import { headers } from "next/headers";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import { serviceDb } from "@/lib/server/db";
import { getSession, siteUrl } from "@/lib/server/session";
import { revokeKeyAction } from "./actions";
import { CreateKeyForm } from "./create-key-form";

export default async function ApiPage() {
  const { db, workspace } = await getSession();
  const [t, locale, keys, usage, origin] = await Promise.all([
    getTranslations("api"),
    getLocale(),
    listApiKeys(db, workspace.id),
    checkAndRecordUsage(serviceDb(), workspace.id, "api_call", { record: false }),
    headers().then(siteUrl),
  ]);
  const hasAccess = PLANS[usage.plan].limits.api;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link href="/docs/api" className={buttonVariants({ variant: "outline" })}>
            {t("docs")}
          </Link>
        }
      />
      {!hasAccess && (
        <p
          role="status"
          className="mb-5 rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          {t("noAccess")}{" "}
          <Link href="/app/settings/billing" className="font-medium underline underline-offset-2">
            →
          </Link>
        </p>
      )}

      <section className="mb-8 space-y-4" aria-labelledby="keys-title">
        <div>
          <h2 id="keys-title" className="text-lg font-semibold">
            {t("keys")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("keysHint")}</p>
          {hasAccess && usage.limit !== null && (
            <p className="mt-1 text-sm">
              {t("quota", {
                used: usage.used.toLocaleString(locale),
                limit: usage.limit.toLocaleString(locale),
              })}
            </p>
          )}
        </div>
        <CreateKeyForm />
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("name")}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("prefix")}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("createdAt")}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("lastUsed")}
                  </th>
                  <th scope="col" className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">{k.name}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{k.prefix}…</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatDateTime(k.created_at, locale)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {k.last_used_at ? formatDateTime(k.last_used_at, locale) : t("never")}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {k.revoked_at ? (
                        <Badge tone="outline">{t("revoked")}</Badge>
                      ) : (
                        <form action={revokeKeyAction}>
                          <input type="hidden" name="key_id" value={k.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            {t("revoke")}
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Card className="mb-8 p-4">
        <h2 className="text-sm font-medium">{t("example")}</h2>
        <pre className="mt-2 overflow-x-auto text-sm">{`curl "${origin}/api/v1/ads?q=gratis%20verzending&country=NL&min_days=30" \\
  -H "Authorization: Bearer tt_live_..."`}</pre>
      </Card>

      <Card className="p-4">
        <h2 className="font-medium">{t("mcpTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("mcpBody")}</p>
      </Card>
    </>
  );
}
