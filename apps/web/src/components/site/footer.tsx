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
    <footer className="relative overflow-hidden border-t border-white/[0.06] bg-[#0a0a0b]">
      <div className="s-wrap grid gap-12 pt-16 pb-8 md:grid-cols-[1.2fr_2fr]">
        <div>
          <Link href="/" aria-label="TrendTrack, naar de homepage">
            <Logo />
          </Link>
          <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-[#d4d4d8]">
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
      <div className="s-wrap relative flex flex-col gap-6 pt-6 pb-10 md:flex-row md:items-end md:justify-between">
        {/* Decoratief woordmerk: als CSS-inhoud, zodat het geen tekst is voor schermlezers of contrastchecks. */}
        <div
          aria-hidden
          data-word="trendtrack"
          className="pointer-events-none font-[family-name:var(--font-display)] leading-[0.8] font-extrabold tracking-[-0.06em] text-white/[0.035] select-none before:content-[attr(data-word)]"
          style={{ fontSize: "clamp(4rem, 15vw, 15rem)" }}
        />
        <div className="flex shrink-0 items-end gap-4 text-[14px] text-[var(--s-muted)] md:text-right">
          <span
            aria-hidden
            className="size-12 shrink-0 rounded-md bg-[linear-gradient(135deg,#2ad1ae,#0c7866_55%,#064a3e)]"
          />
          <div>
            <p className="text-[var(--s-ink)]">Gemaakt in {SITE.city}</p>
            <p>
              © {new Date().getFullYear()} TrendTrack. Ad-data uit de officiële Meta Ad Library
              (EU).
            </p>
            <p>Omzetcijfers zijn schattingen, altijd als bandbreedte.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
