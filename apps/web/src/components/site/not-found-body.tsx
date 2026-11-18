import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";

/**
 * Inhoud van de 404: een groot getal op een diepgroen paneel, een zoekveld naar een webshop (gaat naar
 * het dashboard) en de drie plekken waar mensen meestal heen willen.
 */
export function NotFoundBody({ dashboard = false }: { dashboard?: boolean }) {
  return (
    <section aria-labelledby="nf-title" className="s-inset s-dark s-grain mt-2">
      <div className="s-wrap grid items-center gap-10 py-[clamp(64px,9vw,128px)] lg:grid-cols-[1fr_auto]">
        <div>
          <p className="s-eyebrow">Pagina niet gevonden</p>
          <h1 id="nf-title" className="mt-6" style={{ fontSize: "var(--step-display)" }}>
            Deze pagina <span className="s-accent-text">bestaat niet.</span>
          </h1>
          <p className="mt-5 max-w-[34rem] text-[var(--step-lead)] leading-relaxed text-[var(--s-body)]">
            De link is oud of er zit een typfout in. Zoek een webshop, of ga naar een van de
            pagina&apos;s hieronder.
          </p>
          <form action="/app/shops" method="get" role="search" className="mt-8 max-w-[34rem]">
            <label htmlFor="nf-q" className="sr-only">
              Domein of naam van een webshop
            </label>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[var(--s-faint)]"
                aria-hidden
              />
              <input
                id="nf-q"
                name="q"
                className="s-input !h-14 !rounded-2xl !pl-11 !text-[16px]"
                placeholder="bijvoorbeeld bosbad.be"
                autoComplete="off"
              />
            </span>
          </form>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={dashboard ? "/app/shops" : "/"} className="s-btn">
              <span className="s-btn-icon">
                <ArrowRight className="size-4" aria-hidden />
              </span>
              {dashboard ? "Naar het dashboard" : "Naar de homepage"}
            </Link>
            <Link href="/tools" className="s-btn-ghost">
              Gratis tools
            </Link>
            <Link href="/prijzen" className="s-btn-ghost">
              Prijzen
            </Link>
          </div>
        </div>
        <p
          aria-hidden
          className="hidden font-[family-name:var(--font-display)] text-[clamp(8rem,16vw,15rem)] leading-none font-bold tracking-[-0.06em] text-white/10 lg:block"
        >
          404
        </p>
      </div>
    </section>
  );
}
