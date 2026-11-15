import { Search } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AppNav } from "@/components/app/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSession } from "@/lib/server/session";
import { searchAction, setLocaleAction } from "./actions";

export const metadata = { title: "TrendTrack", robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, isAdmin } = await getSession();
  const [t, tc, locale] = await Promise.all([
    getTranslations("nav"),
    getTranslations("common"),
    getLocale(),
  ]);
  const other = locale === "nl" ? "en" : "nl";

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border p-3 md:flex">
        <Link href="/app/shops" className="mb-4 px-2.5 py-1 text-sm font-semibold tracking-tight">
          TrendTrack
        </Link>
        <AppNav isAdmin={isAdmin} orientation="vertical" />
        <div className="mt-auto space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <p className="truncate px-2.5" title={user.email}>
            {user.email}
          </p>
          <p className="truncate px-2.5">{workspace.name}</p>
          <div className="flex items-center gap-1">
            <form action={setLocaleAction}>
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
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="sm">
                {tc("signOut")}
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-2.5 md:px-8">
            <Link href="/app/shops" className="text-sm font-semibold md:hidden">
              TrendTrack
            </Link>
            <form action={searchAction} role="search" className="relative w-full max-w-xl">
              <Search
                className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                name="q"
                type="search"
                placeholder={t("searchPlaceholder")}
                aria-label={t("search")}
                className="pl-9"
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
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
