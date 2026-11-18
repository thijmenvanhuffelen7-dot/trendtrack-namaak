import { confidenceLevel } from "@trendtrack/core";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/misc";
import { formatMoney, formatMoneyRange } from "@/lib/format";

/** Compacte bandbreedte voor tabellen: "€ 18K – € 37K" met het label "schatting". */
export async function EstimateRange({ low, high }: { low: number | null; high: number | null }) {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const range = formatMoneyRange(low, high, locale);
  if (!range) return <span className="text-muted-foreground">{t("shops.noEstimate")}</span>;
  return (
    <span className="tabular whitespace-nowrap">
      {range} <span className="text-xs text-muted-foreground">({t("common.estimate")})</span>
    </span>
  );
}

/** Grote schattingskaart op de shop-pagina: bandbreedte, betrouwbaarheid en eerlijke uitleg. */
export async function EstimateCard({
  low,
  mid,
  high,
  confidence,
  signals,
}: {
  low: number | null;
  mid: number | null;
  high: number | null;
  confidence: number | null;
  signals: string[];
}) {
  const [t, locale] = await Promise.all([getTranslations("estimate"), getLocale()]);
  const range = formatMoneyRange(low, high, locale);
  const level = confidenceLevel(confidence);
  const known = signals.filter((s): s is "ads" | "sellouts" | "reviews" =>
    ["ads", "sellouts", "reviews"].includes(s),
  );

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5"
      aria-labelledby="estimate-title"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="estimate-title" className="text-sm font-medium text-muted-foreground">
          {t("title")}
        </h2>
        {level && (
          <Badge tone={level === "rough" ? "warning" : "neutral"}>{t(`confidence.${level}`)}</Badge>
        )}
      </div>
      {range ? (
        <>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular">
            {range}{" "}
            <span className="text-base font-normal text-muted-foreground">
              / {locale === "en" ? "month" : "maand"}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("mid", { value: formatMoney(mid, locale, { compact: true }) })}
            {known.length > 0 && (
              <> · {t("basedOn", { signals: known.map((s) => t(`signals.${s}`)).join(", ") })}</>
            )}
          </p>
          <p className="mt-3 text-sm">
            {t("disclaimer")}{" "}
            <a href="/schattingen" className="underline underline-offset-2 hover:no-underline">
              {t("how")}
            </a>
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-xl font-semibold">{t("none")}</p>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {t("noneBody")}{" "}
            <a href="/schattingen" className="underline underline-offset-2 hover:no-underline">
              {t("how")}
            </a>
          </p>
        </>
      )}
    </section>
  );
}
