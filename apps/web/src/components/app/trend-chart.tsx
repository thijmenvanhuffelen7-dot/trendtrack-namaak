"use client";

import { useId, useMemo, useState } from "react";

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  value: number | null;
  low?: number | null;
  high?: number | null;
}

interface Props {
  title: string;
  points: TrendPoint[];
  locale: string;
  kind: "currency" | "count";
  /** Tekst bij de band (laag–hoog), bv. "schatting". */
  bandLabel?: string;
  tableLabel: string;
  dateLabel: string;
}

const W = 520;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 22, left: 44 };

/**
 * Lijngrafiek voor één reeks (titel benoemt de reeks, dus geen legenda). Eén y-as; de optionele
 * band laat de onzekerheid van een schatting zien. Hover: stippellijn + tooltip. Tabelweergave
 * eronder voor wie de cijfers wil lezen.
 */
export function TrendChart({
  title,
  points,
  locale,
  kind,
  bandLabel,
  tableLabel,
  dateLabel,
}: Props) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const tag = locale === "en" ? "en-GB" : "nl-NL";

  const fmt = useMemo(() => {
    // Zelf afkorten in plaats van Intl "compact": dat geeft op de server en in de browser
    // soms een andere uitkomst (hydration-fout).
    const plain = new Intl.NumberFormat(tag, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    const short = (n: number) =>
      n >= 1_000_000
        ? `${plain.format(n / 1_000_000)}M`
        : n >= 10_000
          ? `${plain.format(n / 1000)}K`
          : plain.format(Math.round(n));
    const value = { format: (n: number) => (kind === "currency" ? `€ ${short(n)}` : short(n)) };
    const date = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: "UTC" });
    return {
      value: (n: number) => value.format(n),
      date: (d: string) => date.format(new Date(`${d}T00:00:00Z`)),
    };
  }, [kind, tag]);

  const withValue = points.filter((p): p is TrendPoint & { value: number } => p.value !== null);
  if (withValue.length < 2) return null;

  // Band alleen tekenen als de meeste punten een laag/hoog hebben; ontbrekende vullen we met de waarde zelf.
  const banded = withValue.filter(
    (p) => typeof p.low === "number" && typeof p.high === "number",
  ).length;
  const hasBand = banded >= withValue.length / 2;
  const data = withValue.map((p) => ({
    ...p,
    low: hasBand ? (p.low ?? p.value) : null,
    high: hasBand ? (p.high ?? p.value) : null,
  }));

  const max = Math.max(...data.map((p) => Math.max(p.value, p.high ?? 0))) || 1;
  // Aantallen: zorg dat het midden van de as een heel getal is (geen "2,5 ads").
  let yMax = niceCeil(max);
  if (kind === "count" && (yMax / 2) % 1 !== 0) yMax += 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;

  const line = data
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  const band = hasBand
    ? `${data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.high as number).toFixed(1)}`).join(" ")} ${data
        .map(
          (p, i) =>
            `L${x(data.length - 1 - i).toFixed(1)},${y(data[data.length - 1 - i]!.low as number).toFixed(1)}`,
        )
        .join(" ")} Z`
    : null;
  const ticks = [0, yMax / 2, yMax];
  const last = data[data.length - 1]!;
  const active = hover !== null ? data[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / innerW) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };

  return (
    <figure className="rounded-lg border border-border bg-card p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted-foreground tabular">
          {active ? `${fmt.date(active.date)} · ` : ""}
          <span className="font-medium text-foreground">{fmt.value((active ?? last).value)}</span>
          {hasBand && bandLabel && (
            <>
              {" "}
              ({fmt.value((active ?? last).low as number)} –{" "}
              {fmt.value((active ?? last).high as number)}, {bandLabel})
            </>
          )}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full touch-none select-none"
        role="img"
        aria-labelledby={`${id}-t`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <title
          id={`${id}-t`}
        >{`${title}: ${fmt.date(data[0]!.date)} – ${fmt.date(last.date)}`}</title>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(tick) + 3.5}
              textAnchor="end"
              fontSize={10}
              fill="var(--muted-foreground)"
            >
              {fmt.value(tick)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 5} fontSize={10} fill="var(--muted-foreground)">
          {fmt.date(data[0]!.date)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 5}
          fontSize={10}
          textAnchor="end"
          fill="var(--muted-foreground)"
        >
          {fmt.date(last.date)}
        </text>
        {band && <path d={band} fill="var(--series-1)" opacity={0.1} />}
        <path
          d={line}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {active && hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              opacity={0.5}
            />
            <circle
              cx={x(hover)}
              cy={y(active.value)}
              r={4}
              fill="var(--series-1)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          {tableLabel}
        </summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="w-full tabular">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 font-medium">
                  {dateLabel}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {title}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((p) => (
                <tr key={p.date} className="border-t border-border">
                  <td className="py-1">{fmt.date(p.date)}</td>
                  <td className="py-1 text-right">
                    {fmt.value(p.value)}
                    {hasBand && ` (${fmt.value(p.low as number)} – ${fmt.value(p.high as number)})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Ronde bovengrens voor de y-as (1, 2, 2.5, 5 × 10^n). */
export function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(n));
  const f = n / pow;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return step * pow;
}
