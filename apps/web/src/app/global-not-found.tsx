import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { NotFoundBody } from "@/components/site/not-found-body";
import { cabinet, satoshi } from "./fonts";

export const metadata: Metadata = {
  title: "Pagina niet gevonden · TrendTrack",
  robots: { index: false },
};

/**
 * 404 voor URL's die bij geen enkele route horen. Nodig omdat de site en het dashboard elk een eigen
 * root-layout hebben; deze pagina rendert daarom zelf <html> en <body>.
 */
export default function GlobalNotFound() {
  return (
    <html lang="nl">
      <body className="antialiased">
        <div className={`site ${satoshi.variable} ${cabinet.variable}`}>
          <SiteHeader />
          <main id="inhoud">
            <NotFoundBody />
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
