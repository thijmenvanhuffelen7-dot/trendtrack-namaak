"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export interface ShowcaseAd {
  advertiser: string;
  domain: string;
  title: string;
  body: string;
  days: number;
  reach: string;
  spend: string;
}

/**
 * Een echte ad uit de database, zoals hij in het product staat. De knop werkt: volg het merk en de
 * kaart laat zien wat er dan gebeurt.
 */
export function Showcase({ ad }: { ad: ShowcaseAd }) {
  const [followed, setFollowed] = useState(false);
  return (
    <section aria-labelledby="showcase-title" className="s-section relative overflow-x-clip">
      <div className="s-wrap grid items-center gap-14 lg:grid-cols-2">
        <div data-reveal>
          <span className="s-eyebrow">Ads</span>
          <h2 id="showcase-title" className="mt-5" style={{ fontSize: "var(--step-head)" }}>
            Elke ad, met <span className="s-accent-text">wat hij kost</span>
          </h2>
          <p className="mt-5 max-w-xl text-[var(--step-lead)] leading-relaxed text-[var(--s-body)]">
            Meta laat in de EU zien hoeveel mensen een ad bereikt. Wij rekenen dat om naar wat hij
            ongeveer kost, en tellen hoe lang hij al loopt. Wat maanden draait, verdient zijn geld
            terug.
          </p>
          <dl className="mt-10 grid max-w-xl grid-cols-[auto_auto_1fr] gap-x-10 gap-y-6">
            {[
              [`${ad.days}`, "dagen live"],
              [ad.reach, "EU-bereik"],
              [ad.spend.replace(/ /g, " "), "geschatte spend"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="font-[family-name:var(--font-display)] text-[clamp(1.2rem,1.9vw,1.7rem)] leading-none font-bold tracking-[-0.03em] whitespace-nowrap">
                  {v}
                </dd>
                <dd className="mt-2 text-[14px] text-[var(--s-muted)]">{l}</dd>
              </div>
            ))}
          </dl>
          <Link href="/tools/winnende-ads-finder" className="s-btn mt-10">
            <span className="s-btn-icon">
              <ArrowRight className="size-4" aria-hidden />
            </span>
            Zoek winnende ads
          </Link>
        </div>

        <div data-reveal className="relative">
          <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(12_120_102/0.14),transparent)] blur-2xl" />
          <div className="s-frame">
            <p className="s-label px-3 pt-2 pb-2.5">Ad · {ad.domain}</p>
            <article className="s-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#2ad1ae] to-[#075245] font-[family-name:var(--font-display)] font-bold">
                    {ad.advertiser.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{ad.advertiser}</p>
                    <p className="text-[13px] text-[var(--s-muted)]">Gesponsord · {ad.domain}</p>
                  </div>
                </div>
                <span className="s-tag bg-[#dff5ee] text-[#0a5c4e]">
                  {ad.days >= 30 ? "Lang lopend" : "Actief"}
                </span>
              </div>
              <p className="mt-5 text-[18px] font-medium">{ad.title}</p>
              <p className="mt-1 text-[15px] text-[var(--s-body)]">{ad.body}</p>
              <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-[var(--s-line)] bg-[var(--s-line)] text-[13px]">
                {[
                  ["Loopt", `${ad.days} dagen`],
                  ["Bereik", ad.reach],
                  ["Spend", ad.spend],
                ].map(([l, v]) => (
                  <div key={l} className="bg-[var(--s-surface)] px-3 py-2.5">
                    <p className="text-[var(--s-faint)]">{l}</p>
                    <p className="mt-0.5 font-medium text-[var(--s-ink)]">{v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-[13px] text-[var(--s-faint)]">
                  Spend is een schatting uit bereik
                </p>
                <button
                  type="button"
                  onClick={() => setFollowed((f) => !f)}
                  aria-pressed={followed}
                  className={followed ? "s-btn-ghost !min-h-10 !px-4" : "s-btn !min-h-10 !px-4"}
                >
                  {followed ? (
                    <>
                      <Check className="size-4 text-[var(--s-accent-soft)]" aria-hidden /> In je
                      Brandtracker
                    </>
                  ) : (
                    "Volg dit merk"
                  )}
                </button>
              </div>
            </article>
          </div>
          <p className="mt-3 text-center text-[13px] text-[var(--s-faint)]" aria-live="polite">
            {followed
              ? "Vanaf nu zie je elke nieuwe ad en prijswijziging van dit merk in je feed."
              : "Probeer het: klik op Volg dit merk."}
          </p>
        </div>
      </div>
    </section>
  );
}
