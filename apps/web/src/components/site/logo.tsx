import { useId } from "react";

/** Woordmerk: een teal tegel met een stijgende lijn, plus de naam. */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  // Unieke id per instantie: met een gedeelde id valt het verloop weg als de eerste verborgen is.
  const id = `tt-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2ad1ae" />
          <stop offset="0.55" stopColor="#0c7866" />
          <stop offset="1" stopColor="#064a3e" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6.5" fill={`url(#${id})`} />
      <path
        d="M5.5 16.5l4.2-4.4 3 2.8 5.8-6.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.8 8.5h3.7v3.7"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-[19px] font-bold tracking-[-0.03em]">
      <LogoMark />
      TrendTrack
    </span>
  );
}
