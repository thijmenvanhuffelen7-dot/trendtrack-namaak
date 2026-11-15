import Link from "next/link";
import { NAV } from "@/lib/site/config";

/** Kale balk: woordmerk links, links op de as, één actie. Geen pill, geen glas. */
export function SiteHeader() {
  return (
    <>
      <header className="s-wrap grid grid-cols-[1fr_auto] items-center gap-4 py-5 md:grid-cols-[var(--s-axis)_1fr]">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          TrendTrack
        </Link>
        <nav
          aria-label="Hoofdmenu"
          className="flex items-center justify-end gap-5 text-[15px] md:justify-between"
        >
          <ul className="hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className="text-[var(--s-muted)] transition-colors hover:text-[var(--s-ink)]"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <span className="flex items-center gap-5">
            <Link
              href="/login"
              className="text-[var(--s-muted)] transition-colors hover:text-[var(--s-ink)]"
            >
              Inloggen
            </Link>
            <Link href="/login" className="s-btn !min-h-10 !px-4 text-[15px]">
              Gratis account
            </Link>
          </span>
        </nav>
      </header>
      <nav
        aria-label="Menu"
        className="s-wrap -mt-1 flex gap-5 overflow-x-auto pb-2 text-[15px] md:hidden"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="shrink-0 text-[var(--s-muted)] hover:text-[var(--s-ink)]"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
