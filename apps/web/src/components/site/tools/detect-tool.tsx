"use client";

import { useState } from "react";
import { DomainForm, getJson } from "./fields";

interface Result {
  domain: string;
  isShopify: boolean;
  name: string | null;
  theme: string | null;
  country: string | null;
  currency: string | null;
  apps: { id: string; name: string; category: string }[];
}

const CATEGORY: Record<string, string> = {
  email: "E-mail",
  sms: "Sms",
  reviews: "Reviews",
  trust: "Keurmerken",
  subscriptions: "Abonnementen",
  upsell: "Upsell",
  conversion: "Conversie",
  "page-builder": "Paginabouwer",
  loyalty: "Loyaliteit",
  support: "Klantenservice",
  search: "Zoeken",
  translation: "Vertaling",
  payments: "Betalen",
  analytics: "Analytics",
  pixel: "Advertentiepixels",
  popup: "Pop-ups",
  consent: "Cookies",
  shipping: "Verzending",
  other: "Overig",
};

export function DetectTool({ mode }: { mode: "theme" | "apps" }) {
  const [r, setR] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const run = async (domain: string) => {
    setPending(true);
    setError(null);
    const res = await getJson<Result>(`/api/public/detect?domain=${encodeURIComponent(domain)}`);
    setPending(false);
    if (res.ok) setR(res.data);
    else {
      setR(null);
      setError(res.error);
    }
  };
  const groups = new Map<string, string[]>();
  for (const a of r?.apps ?? [])
    groups.set(a.category, [...(groups.get(a.category) ?? []), a.name]);

  return (
    <div>
      <DomainForm
        onSubmit={run}
        pending={pending}
        button={mode === "theme" ? "Zoek het thema" : "Zoek de apps"}
      />
      <div aria-live="polite" className="mt-8">
        {error && <p className="text-[var(--s-yellow)]">{error}</p>}
        {r && (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="rounded-2xl bg-[linear-gradient(135deg,#19b394,#0c7866_55%,#075245)] shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] p-6">
              <p className="text-[15px]">{r.name ?? r.domain}</p>
              <p className="mt-2 text-[clamp(2rem,4vw,3.4rem)] leading-none font-semibold tracking-[-0.04em]">
                {r.isShopify ? (r.theme ?? "Eigen thema") : "Geen Shopify"}
              </p>
              <p className="mt-3 text-[15px]">
                {r.isShopify ? "Shopify-thema" : "Deze winkel draait niet op Shopify."}
                {r.country ? ` · ${r.country}` : ""}
                {r.currency ? ` · ${r.currency}` : ""}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--s-line)] bg-white/[0.02] p-6">
              <p className="font-medium">{r.apps.length} apps en tools herkend</p>
              {r.apps.length === 0 ? (
                <p className="mt-2 text-[var(--s-muted)]">
                  Geen bekende apps gevonden op de homepage.
                </p>
              ) : (
                <dl className="mt-3 space-y-2">
                  {[...groups].map(([cat, names]) => (
                    <div key={cat} className="grid grid-cols-[9rem_1fr] gap-3">
                      <dt className="text-[var(--s-muted)]">{CATEGORY[cat] ?? cat}</dt>
                      <dd>{names.join(", ")}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
