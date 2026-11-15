"use client";

import { useEffect, useRef, useState } from "react";

export interface Step {
  title: string;
  accent?: string;
  text: string;
}

/**
 * Genummerde punten (01, 02, 03) waarvan het punt in het midden van het scherm oplicht. Zonder
 * JavaScript of met "minder beweging" zijn alle punten gewoon volledig zichtbaar.
 */
export function NumberedSteps({ steps }: { steps: Step[] }) {
  const [active, setActive] = useState<number | null>(null);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      // Alleen een smalle band in het midden van het scherm telt.
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    setActive(0);
    return () => io.disconnect();
  }, []);

  return (
    <ol className="relative space-y-8">
      <span aria-hidden className="absolute top-2 bottom-2 left-[17px] w-px bg-[var(--s-line-2)]" />
      {steps.map((s, i) => {
        const on = active === null || active === i;
        return (
          <li
            key={s.title}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-index={i}
            className={`relative flex gap-5 transition-opacity duration-500 ${on ? "opacity-100" : "opacity-40"}`}
          >
            <span
              className={`relative grid size-9 shrink-0 place-items-center rounded-[10px] text-[13px] font-semibold transition-colors duration-500 ${
                on
                  ? "bg-[var(--s-ink)] text-[var(--s-bg)]"
                  : "bg-[var(--s-bg-2)] text-[var(--s-muted)]"
              }`}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="pt-0.5">
              <h3 className="text-[clamp(1.25rem,1.9vw,1.6rem)]">
                {s.title}
                {s.accent && <span className="block text-[var(--s-muted)]">{s.accent}</span>}
              </h3>
              <p className="mt-2 max-w-md text-[16px] leading-relaxed text-[var(--s-body)]">
                {s.text}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
