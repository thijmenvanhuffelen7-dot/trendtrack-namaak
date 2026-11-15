import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { safeNext } from "@/lib/server/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Inloggen · TrendTrack", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const t = await getTranslations("login");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-sm font-semibold tracking-tight">TrendTrack</p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-border p-3 text-sm text-danger">
            {error === "link" ? t("errorLink") : t("errorOauth")}
          </p>
        )}
        <LoginForm
          next={safeNext(next)}
          googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true"}
        />
      </div>
    </main>
  );
}
