"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Zoekpil in de kopbalk. ⌘K of Ctrl+K springt naar het zoekveld in de hero (op de homepage) of
 * opent de homepage op dat veld. Zonder JavaScript is het een gewone link.
 */
export function HeaderSearch() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = document.getElementById("hero-domain") as HTMLInputElement | null;
        if (input) {
          input.scrollIntoView({ behavior: "smooth", block: "center" });
          input.focus();
        } else window.location.href = "/#zoek";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <Link
      href="/#zoek"
      className="hidden h-10 w-60 items-center gap-2 rounded-xl border border-[var(--s-line-2)] bg-[var(--s-field)] px-3 text-[14px] text-[var(--s-faint)] transition-colors hover:border-[var(--s-line-2)] hover:text-[var(--s-muted)] lg:flex"
    >
      <Search className="size-4" aria-hidden />
      <span className="flex-1">Zoek een webshop…</span>
      <kbd className="rounded-md border border-[var(--s-line-2)] bg-[var(--s-tint)] px-1.5 py-0.5 font-sans text-[11px] text-[var(--s-muted)]">
        ⌘ K
      </kbd>
    </Link>
  );
}
