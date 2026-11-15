"use client";

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
 * Eén ad-rij uit het product, drie keer: zoals hij binnenkomt, met de muis erop, en gevolgd.
 * De middelste is echt: de knop zet hem in de derde stand.
 */
export function Showcase({ ad }: { ad: ShowcaseAd }) {
  const [followed, setFollowed] = useState(false);
  const row = (state: "new" | "hover" | "done") => (
    <div
      data-ui
      className={`w-full max-w-[640px] bg-white p-4 text-[#111] ${state === "hover" ? "ring-2 ring-[#1e4bd7]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">{ad.advertiser}</p>
          <p className="text-[13px] text-[#555]">{ad.domain}</p>
        </div>
        <span
          className={`rounded-sm px-1.5 py-0.5 text-[13px] font-medium ${state === "new" ? "bg-[#eef2ff] text-[#1e4bd7]" : "bg-[#e6f4f1] text-[#0c7866]"}`}
        >
          {state === "new" ? "Nieuw" : ad.days >= 30 ? "Lang lopend" : "Actief"}
        </span>
      </div>
      <p className="mt-2 text-[15px] font-medium">{ad.title}</p>
      <p className="text-[15px] text-[#444]">{ad.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[#555]">
        <span>Loopt {state === "new" ? "1 dag" : `${ad.days} dagen`}</span>
        <span>EU-bereik {ad.reach}</span>
        <span>Spend {ad.spend} (schatting)</span>
        {state === "hover" && (
          <button
            type="button"
            onClick={() => setFollowed(true)}
            className="ml-auto bg-[#0c7866] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0e8a75]"
          >
            {followed ? "Gevolgd ✓" : "Volg dit merk"}
          </button>
        )}
        {state === "done" && (
          <span className="ml-auto font-medium text-[#0c7866]">In je Brandtracker</span>
        )}
      </div>
    </div>
  );
  const items: [string, React.ReactNode][] = [
    ["Gevonden", row("new")],
    ["Bekeken", row("hover")],
    [followed ? "Gevolgd, net nu" : "Gevolgd", row("done")],
  ];
  return (
    <section aria-labelledby="showcase-title" className="s-wrap py-[clamp(72px,8vw,120px)]">
      <div data-reveal className="grid gap-y-10 md:grid-cols-12">
        <h2
          id="showcase-title"
          className="md:col-span-8 md:col-start-4"
          style={{ fontSize: "clamp(1.75rem, 1.2rem + 1.6vw, 2.25rem)" }}
        >
          Een ad wordt een winnaar
        </h2>
        <ol className="space-y-14 md:col-span-9 md:col-start-1">
          {items.map(([label, node]) => (
            <li key={label} className="grid items-center gap-3 md:grid-cols-9">
              <span className="order-2 text-[var(--step-lead)] text-[var(--s-muted)] md:order-1 md:col-span-3 md:pr-8 md:text-right">
                {label}
              </span>
              <div className="order-1 md:order-2 md:col-span-6">{node}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
