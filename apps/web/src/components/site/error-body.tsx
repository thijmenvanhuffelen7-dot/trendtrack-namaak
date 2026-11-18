"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";

/** Vriendelijke foutmelding met opnieuw proberen. Toont nooit de technische fout zelf. */
export function ErrorBody({ reset, digest }: { reset: () => void; digest?: string }) {
  return (
    <section aria-labelledby="err-title" className="s-inset s-dark s-grain mt-2">
      <div className="s-wrap py-[clamp(64px,9vw,128px)]">
        <p className="s-eyebrow">Er ging iets mis</p>
        <h1 id="err-title" className="mt-6" style={{ fontSize: "var(--step-display)" }}>
          Dat lukte even niet.
        </h1>
        <p className="mt-5 max-w-[34rem] text-[var(--step-lead)] leading-relaxed text-[var(--s-body)]">
          Er ging iets mis bij het laden van deze pagina. Probeer het opnieuw; blijft het misgaan,
          mail ons dan.
          {digest && (
            <span className="mt-2 block text-[14px] text-[var(--s-faint)]">Code: {digest}</span>
          )}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="s-btn">
            <span className="s-btn-icon">
              <RotateCcw className="size-4" aria-hidden />
            </span>
            Opnieuw proberen
          </button>
          <Link href="/" className="s-btn-ghost">
            Naar de homepage
          </Link>
        </div>
      </div>
    </section>
  );
}
