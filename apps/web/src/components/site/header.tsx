import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { NAV } from "@/lib/site/config";
import { HeaderSearch } from "./header-search";
import { Logo } from "./logo";

/** Glazen kopbalk die blijft staan: woordmerk, navigatie, zoeken en de twee acties. */
export function SiteHeader() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0d0d0e]/70 backdrop-blur-2xl">
        <div className="s-wrap flex h-16 items-center gap-8">
          <Link href="/" aria-label="TrendTrack, naar de homepage">
            <Logo />
          </Link>
          <nav aria-label="Hoofdmenu" className="hidden md:block">
            <ul className="flex items-center gap-1 text-[15px]">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className="rounded-lg px-3 py-2 text-[var(--s-muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--s-ink)]"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <HeaderSearch />
            <Link
              href="/login"
              className="s-btn-ghost !hidden !min-h-10 !rounded-xl !px-4 !text-[14px] sm:!inline-flex"
            >
              Inloggen
            </Link>
            <Link href="/login" className="s-btn !min-h-10 !rounded-xl !px-4 !text-[14px]">
              Gratis account
              <ArrowRight className="s-arrow size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>
      <nav
        aria-label="Menu"
        className="s-wrap flex gap-1 overflow-x-auto border-b border-white/[0.06] py-2 text-[15px] md:hidden"
      >
        {[...NAV, { href: "/login", label: "Inloggen" }].map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="shrink-0 rounded-lg px-3 py-1.5 text-[var(--s-muted)] hover:bg-white/[0.04] hover:text-[var(--s-ink)]"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
