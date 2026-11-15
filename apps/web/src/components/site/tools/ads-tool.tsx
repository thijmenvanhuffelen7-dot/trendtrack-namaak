"use client";

import Link from "next/link";
import { useState } from "react";
import { getJson } from "./fields";

interface Ad {
  title: string | null;
  body: string | null;
  advertiser: string | null;
  landing_domain: string | null;
  days_running: number | null;
  eu_total_reach: number | null;
  spend: { low: number; high: number } | null;
  library_url: string | null;
}

const compact = (n: number) =>
  new Intl.NumberFormat("nl-NL", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export function AdsTool() {
  const [r, setR] = useState<{ q: string; total: number; ads: Ad[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div>
      <form
        className="flex max-w-2xl flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setPending(true);
          setError(null);
          const res = await getJson<{ q: string; total: number; ads: Ad[] }>(
            `/api/public/ads?q=${encodeURIComponent(String(f.get("q")))}&country=${f.get("country")}`,
          );
          setPending(false);
          if (res.ok) setR(res.data);
          else setError(res.error);
        }}
      >
        <label htmlFor="ads-q" className="sr-only">
          Zoekwoord
        </label>
        <input
          id="ads-q"
          name="q"
          required
          minLength={2}
          className="s-input"
          placeholder="bijvoorbeeld gratis verzending"
        />
        <label htmlFor="ads-country" className="sr-only">
          Land
        </label>
        <select id="ads-country" name="country" className="s-input sm:!w-28">
          <option value="NL">NL</option>
          <option value="BE">BE</option>
        </select>
        <button type="submit" className="s-btn shrink-0" disabled={pending}>
          {pending ? "Zoeken…" : "Zoek ads"}
        </button>
      </form>
      <div aria-live="polite" className="mt-8">
        {error && <p className="text-[var(--s-yellow)]">{error}</p>}
        {r && r.ads.length === 0 && (
          <p className="text-[var(--s-muted)]">
            Geen lopende ads gevonden voor “{r.q}”. Probeer een algemener woord.
          </p>
        )}
        {r && r.ads.length > 0 && (
          <>
            <ol className="divide-y divide-[var(--s-bg)] bg-[var(--s-surface)]">
              {r.ads.map((a, i) => (
                <li key={i} className="grid gap-2 p-5 md:grid-cols-[minmax(0,1fr)_12rem]">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {a.advertiser}{" "}
                      <span className="font-normal text-[var(--s-muted)]">
                        · {a.landing_domain}
                      </span>
                    </p>
                    {a.title && <p className="mt-1">{a.title}</p>}
                    <p className="mt-1 line-clamp-2 text-[var(--s-muted)]">{a.body}</p>
                  </div>
                  <dl className="text-[15px] md:text-right">
                    <div>
                      <dt className="sr-only">Looptijd</dt>
                      <dd className="text-[var(--step-lead)] font-semibold tracking-[-0.02em]">
                        {a.days_running} dagen
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Bereik</dt>
                      <dd>{a.eu_total_reach ? `${compact(a.eu_total_reach)} bereik` : "–"}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Spend</dt>
                      <dd className="text-[var(--s-muted)]">
                        {a.spend
                          ? `€ ${compact(a.spend.low)}–${compact(a.spend.high)} (schatting)`
                          : ""}
                      </dd>
                    </div>
                    {a.library_url && (
                      <dd>
                        <a
                          href={a.library_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="s-link"
                        >
                          Bekijk in Meta Ad Library
                        </a>
                      </dd>
                    )}
                  </dl>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[15px]">
              {r.total > r.ads.length ? `${r.total - r.ads.length} ads meer gevonden. ` : ""}
              <Link href="/login" className="s-link">
                Zie alles met een gratis account
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
