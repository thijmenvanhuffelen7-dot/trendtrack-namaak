"use client";

import { useState } from "react";
import { DomainForm, eur, getJson } from "./fields";

interface Result {
  domain: string;
  count: number;
  preview: { title: string; price: number | null; type: string | null }[];
  csv: string;
}

export function ExportTool() {
  const [r, setR] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const run = async (domain: string) => {
    setPending(true);
    setError(null);
    const res = await getJson<Result>(
      `/api/public/products?format=json&domain=${encodeURIComponent(domain)}`,
    );
    setPending(false);
    if (res.ok) setR(res.data);
    else {
      setR(null);
      setError(res.error);
    }
  };
  const download = () => {
    if (!r) return;
    const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${r.domain}-producten.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div>
      <DomainForm onSubmit={run} pending={pending} button="Haal producten op" />
      <div aria-live="polite" className="mt-8">
        {error && <p className="text-[var(--s-yellow)]">{error}</p>}
        {r && (
          <div>
            <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-[linear-gradient(135deg,#19b394,#0c7866_55%,#075245)] shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] text-white p-6">
              <p className="text-[clamp(1.6rem,3vw,2.6rem)] leading-none font-semibold tracking-[-0.04em]">
                {r.count} producten
              </p>
              <button
                type="button"
                onClick={download}
                className="s-btn-ghost !bg-white !text-[#0c7866]"
              >
                Download CSV
              </button>
              {r.count >= 250 && (
                <p className="basis-full text-[15px]">
                  De gratis export stopt bij 250. Alle producten zie je in het dashboard.
                </p>
              )}
            </div>
            <table className="mt-3 w-full overflow-hidden rounded-2xl border border-[var(--s-line)] text-left text-[15px]">
              <caption className="sr-only">Eerste tien producten</caption>
              <thead className="text-[var(--s-muted)]">
                <tr>
                  <th scope="col" className="p-3 font-normal">
                    Product
                  </th>
                  <th scope="col" className="p-3 font-normal">
                    Type
                  </th>
                  <th scope="col" className="p-3 text-right font-normal">
                    Prijs
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.preview.map((p, i) => (
                  <tr key={i} className={i % 2 ? "" : "bg-[var(--s-tint)]"}>
                    <td className="p-3">{p.title}</td>
                    <td className="p-3 text-[var(--s-muted)]">{p.type ?? "–"}</td>
                    <td className="p-3 text-right tabular-nums">
                      {p.price === null ? "–" : eur(p.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
