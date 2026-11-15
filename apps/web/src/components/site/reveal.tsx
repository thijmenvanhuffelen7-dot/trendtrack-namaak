"use client";

import { useEffect } from "react";

/**
 * Zet .js op de site en laat elementen met [data-reveal] binnenkomen zodra ze in beeld komen.
 * Zonder JavaScript staat alles gewoon in beeld (de verberg-regel geldt alleen met .js).
 */
export function Reveal() {
  useEffect(() => {
    const root = document.querySelector(".site");
    root?.classList.add("js");
    const els = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
