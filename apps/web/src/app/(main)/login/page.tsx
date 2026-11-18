import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/site/logo";
import { safeNext } from "@/lib/server/session";
import { cabinet, satoshi } from "../../fonts";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Inloggen · TrendTrack", robots: { index: false } };

/** Loginpagina in de stijl van de publieke site (donker, .site-tokens). */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const { next, error, mode } = await searchParams;
  const t = await getTranslations("login");
  return (
    <div className={`site ${satoshi.variable} ${cabinet.variable}`}>
      <main className="s-glow relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <Link href="/" className="mb-8 inline-flex" aria-label="TrendTrack, naar de homepage">
            <Logo />
          </Link>
          <h1 style={{ fontSize: "clamp(2rem, 1.6rem + 1.4vw, 2.6rem)" }}>
            {mode === "signup" ? t("titleSignUp") : t("title")}
          </h1>
          <p className="mt-3 text-[15px] text-[var(--s-body)]">{t("subtitle")}</p>
          {error && (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-[#e5484d]/40 bg-[#e5484d]/10 p-3 text-[14px] text-[var(--s-danger)]"
            >
              {error === "link" ? t("errorLink") : t("errorOauth")}
            </p>
          )}
          <div className="s-frame mt-8">
            <div className="s-card p-6">
              <LoginForm
                key={mode === "signup" ? "signup" : "signin"}
                next={safeNext(next)}
                googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true"}
                initialMode={mode === "signup" ? "signup" : "signin"}
              />
            </div>
          </div>
          <p className="mt-6 text-center text-[13px] text-[var(--s-faint)]">
            {t("terms")}{" "}
            <Link href="/voorwaarden" className="s-link">
              {t("termsLink")}
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
