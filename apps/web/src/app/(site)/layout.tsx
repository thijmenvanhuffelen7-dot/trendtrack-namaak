import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "../globals.css";
import { Reveal } from "@/components/site/reveal";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { SITE } from "@/lib/site/config";

// Inter Tight in plaats van het voorgestelde Switzer (Fontshare is vanuit de bouwomgeving niet bereikbaar);
// zelf gehost via next/font, dus geen externe request bij bezoekers.
const font = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-site",
  display: "swap",
});

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
        <div id="top" className={`site ${font.variable}`}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
          />
          <a
            href="#inhoud"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-[var(--s-yellow)] focus:px-3 focus:py-2 focus:text-black"
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
