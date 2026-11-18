import { PLANS } from "@trendtrack/core";
import { Search } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AppNav } from "@/components/app/nav";
import { Logo, LogoMark } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPlan, getSession } from "@/lib/server/session";
import { searchAction, setLocaleAction } from "./actions";

export const metadata = { title: "TrendTrack", robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, isAdmin } = await getSession();
  const [t, tc, tl, locale, plan] = await Promise.all([
    getTranslations("nav"),
    getTranslations("common"),
    getTranslations("limits"),
    getLocale(),
    getPlan(),
  ]);
  const trialDays = plan.trialEndsAt
    ? Math.max(0, Math.ceil((Date.parse(plan.trialEndsAt) - Date.now()) / 86_400_000))
    : null;
  const other = locale === "nl" ? "en" : "nl";

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 p-2.5 md:block">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[22px] bg-[radial-gradient(90%_60%_at_10%_0%,rgb(42_209_174/0.18),transparent_60%),linear-gradient(170deg,#0f4d41_0%,#0a3a31_50%,#062621_100%)] p-3 text-white">
          <Link href="/app/shops" className="mb-5 flex px-2.5 pt-1.5" aria-label="TrendTrack">
            <Logo tone="light" className="!text-[21px]" />
          </Link>
          <AppNav isAdmin={isAdmin} orientation="vertical" />
          <div className="mt-auto space-y-3 border-t border-white/10 pt-3 text-xs text-white/65">
            <div className="px-2.5">
              <p className="truncate text-[13px] font-medium text-white" title={user.email}>
                {user.email}
              </p>
              <p className="truncate">{workspace.name}</p>
            </div>
            <Link
              href="/app/settings/billing"
              className="mx-2.5 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/15"
            >
              {trialDays !== null ? tl("trialBadge", { count: trialDays }) : PLANS[plan.plan].name}
              <span aria-hidden>→</span>
            </Link>
            <div className="flex items-center gap-1 px-1">
              <form action={setLocaleAction}>
                <input type="hidden" name="locale" value={other} />
                <button
                  type="submit"
                  className="rounded-lg px-2.5 py-1.5 text-[13px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={`${tc("language")}: ${other.toUpperCase()}`}
                >
                  {other.toUpperCase()}
                </button>
              </form>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-lg px-2.5 py-1.5 text-[13px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {tc("signOut")}
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 md:px-8">
            <Link href="/app/shops" className="flex shrink-0 md:hidden" aria-label="TrendTrack">
              <LogoMark className="size-7 sm:hidden" />
              <span className="hidden sm:block">
                <Logo className="!text-[18px]" />
              </span>
            </Link>
            <form action={searchAction} role="search" className="relative w-full max-w-xl">
              <Search
                className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                name="q"
                type="search"
                placeholder={t("searchPlaceholder")}
                aria-label={t("search")}
                className="pl-10"
                autoComplete="off"
              />
            </form>
            <form action={setLocaleAction} className="md:hidden">
              <input type="hidden" name="locale" value={other} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                aria-label={`${tc("language")}: ${other.toUpperCase()}`}
              >
                {other.toUpperCase()}
              </Button>
            </form>
            <form action="/auth/signout" method="post" className="md:hidden">
              <Button type="submit" variant="ghost" size="sm">
                {tc("signOut")}
              </Button>
            </form>
          </div>
          <div className="border-t border-border md:hidden">
            <AppNav isAdmin={isAdmin} orientation="horizontal" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-7 md:px-8">{children}</main>
      </div>
    </div>
  );
}
