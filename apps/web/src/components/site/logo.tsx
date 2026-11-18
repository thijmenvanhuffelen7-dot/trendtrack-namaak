import { useId } from "react";

/** De pijl die uit de tegel is gesneden (evenodd: tegel min pijl). Ook gebruikt voor favicon en app-icoon. */
export const MARK_PATH =
  "M0 0H24V24H0Z M5.4 25V24C5.9 17 9.3 11.4 12.9 7.9L11 6L20.4 3.6L18 13L16.1 11.1C12.6 14.6 11 18.5 10.6 24V25Z";

/**
 * Beeldmerk: een teal tegel waar een stijgende pijl uit is gesneden. De pijl is echt uitgespaard, dus
 * de achtergrond schijnt erdoor, op licht en op donker. `tone="light"` maakt de tegel wit.
 */
export function LogoMark({
  className = "size-6",
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "light";
}) {
  // Unieke ids per instantie: met gedeelde ids valt het verloop weg als de eerste verborgen is.
  const uid = useId().replace(/:/g, "");
  const grad = `tt-g-${uid}`;
  const clip = `tt-c-${uid}`;
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2ad1ae" />
          <stop offset="0.55" stopColor="#0c7866" />
          <stop offset="1" stopColor="#064a3e" />
        </linearGradient>
        <clipPath id={clip}>
          <rect width="24" height="24" rx="5" />
        </clipPath>
      </defs>
      <path
        d={MARK_PATH}
        fillRule="evenodd"
        clipPath={`url(#${clip})`}
        fill={tone === "light" ? "#fff" : `url(#${grad})`}
      />
    </svg>
  );
}

/** Woordmerk: beeldmerk plus "trendtrack" in kleine letters met een zacht verloop. */
export function Logo({
  tone = "ink",
  className = "",
}: {
  tone?: "ink" | "light";
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-[20px] font-bold tracking-[-0.045em] ${className}`}
    >
      <LogoMark className="size-[1.2em]" tone={tone === "light" ? "light" : "brand"} />
      <span className={tone === "light" ? "tt-word-light" : "tt-word"}>trendtrack</span>
    </span>
  );
}
