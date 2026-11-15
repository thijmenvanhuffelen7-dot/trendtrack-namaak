import type { Metadata } from "next";
import "../globals.css";
import { Reveal } from "@/components/site/reveal";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { cabinet, satoshi } from "../fonts";
import { SITE } from "@/lib/site/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "TrendTrack – omzet, ads en nieuwsbrieven van Benelux-webshops",
    template: "%s · TrendTrack",
  },
  description:
    "Zie de geschatte omzet, de lopende Meta-ads en de nieuwsbrieven van elke webshop in Nederland en België. Gratis beginnen, ook via Claude of ChatGPT.",
  openGraph: { type: "website", locale: "nl_NL", siteName: "TrendTrack" },
  alternates: { canonical: "/" },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#org`,
      name: "TrendTrack",
      url: SITE.url,
      email: SITE.email,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#site`,
      url: SITE.url,
      name: "TrendTrack",
      inLanguage: "nl-NL",
      publisher: { "@id": `${SITE.url}/#org` },
    },
  ],
};

/**
 * Eigen root-layout voor de publieke site: vast Nederlands, zonder cookies, zodat de pagina's
 * statisch zijn en title/description in de <head> staan. Het dashboard heeft (main)/layout.tsx.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="antialiased">
        <div id="top" className={`site ${satoshi.variable} ${cabinet.variable}`}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
          />
          <a
            href="#inhoud"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-[var(--s-accent)] focus:px-3 focus:py-2 focus:text-white"
          >
            Naar de inhoud
          </a>
          <SiteHeader />
          <main id="inhoud">{children}</main>
          <SiteFooter />
          <Reveal />
        </div>
      </body>
    </html>
  );
}
