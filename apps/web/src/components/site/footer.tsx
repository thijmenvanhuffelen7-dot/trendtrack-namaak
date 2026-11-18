import Link from "next/link";
import { SITE } from "@/lib/site/config";
import { Logo } from "./logo";

const COLUMNS: [string, [string, string][]][] = [
  [
    "Product",
    [
      ["/#zoek", "Omzet bekijken"],
      ["/prijzen", "Prijzen"],
      ["/schattingen", "Hoe we schatten"],
      ["/login", "Inloggen"],
    ],
  ],
  [
    "Gratis tools",
    [
      ["/tools/shopify-theme-detector", "Thema-detector"],
      ["/tools/shopify-apps-detector", "Apps-detector"],
      ["/tools/shopify-product-exporter", "Productexport"],
      ["/tools/winnende-ads-finder", "Winnende ads"],
      ["/tools/roas-break-even-calculator", "ROAS-calculator"],
      ["/tools", "Alle tools"],
    ],
  ],
  [
    "Ontwikkelaars",
    [
      ["/docs/api", "REST API"],
      ["/#mcp", "MCP-server"],
      ["/blog", "Blog"],
    ],
  ],
  [
    "Bedrijf",
    [
      ["/affiliate", "Affiliate"],
      ["/privacy", "Privacy"],
      ["/voorwaarden", "Voorwaarden"],
      ["/opt-out", "Shop laten verwijderen"],
    ],
  ],
];

/** Afsluiter: kolommen met links, en onderaan het woordmerk groot en bijna onzichtbaar. */
export function SiteFooter() {
  return (
    <footer className="s-inset s-dark mt-4 mb-3">
      <div className="s-wrap grid gap-12 pt-16 pb-8 md:grid-cols-[1.2fr_2fr]">
        <div>
          <Link href="/" aria-label="TrendTrack, naar de homepage">
            <Logo tone="light" />
          </Link>
          <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-[var(--s-body)]">
            Zie wat webshops in Nederland en België verkopen, waar ze op adverteren en wat ze
            mailen.
          </p>
          <p className="mt-5 text-[15px] text-[var(--s-muted)]">
            Vragen?{" "}
            <a href={`mailto:${SITE.email}`} className="s-link text-[var(--s-ink)]">
              {SITE.email}
            </a>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLUMNS.map(([title, links]) => (
            <div key={title}>
              <h2 className="font-[family-name:var(--font-satoshi)] text-[15px] font-medium tracking-normal">
                {title}
              </h2>
              <ul className="mt-4 space-y-3 text-[15px]">
                {links.map(([href, label]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-[var(--s-muted)] transition-colors hover:text-[var(--s-ink)]"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="s-wrap flex flex-col gap-4 border-t border-[var(--s-line)] pt-6 text-[14px] text-[var(--s-muted)] md:flex-row md:items-center md:justify-between">
        <p>
          © {new Date().getFullYear()} TrendTrack · Gemaakt in {SITE.city}
        </p>
        <p>Ad-data uit de officiële Meta Ad Library (EU). Omzetcijfers zijn schattingen.</p>
      </div>
      {/* Decoratief woordmerk: als CSS-inhoud, zodat het geen tekst is voor schermlezers of contrastchecks. */}
      <div className="s-wrap overflow-hidden pt-4">
        <div
          aria-hidden
          data-word="trendtrack"
          className="pointer-events-none -mb-[0.18em] font-[family-name:var(--font-display)] leading-none font-bold tracking-[-0.06em] whitespace-nowrap text-[var(--s-ghost)] select-none before:content-[attr(data-word)]"
          style={{ fontSize: "clamp(4rem, 17.5vw, 16.5rem)" }}
        />
      </div>
    </footer>
  );
}
