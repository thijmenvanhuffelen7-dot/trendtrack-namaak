import Link from "next/link";
import { SITE } from "@/lib/site/config";

/** Afsluiter als een vol kleurvlak: het contactadres is de kop. */
export function SiteFooter() {
  const [user, host] = SITE.email.split("@");
  return (
    <footer className="bg-[var(--s-red)] text-white">
      <div className="s-wrap flex min-h-[70svh] flex-col justify-between gap-16 py-10">
        <div className="flex flex-wrap items-start justify-between gap-6 text-[15px]">
          <p className="max-w-md">
            <span className="font-semibold">TrendTrack</span> onderzoekt webshops, ads en
            nieuwsbrieven in Nederland en België. Omzetcijfers zijn schattingen;{" "}
            <Link href="/schattingen" className="s-link">
              zo schatten we
            </Link>
            .
          </p>
          <a href="#top" className="s-link">
            Naar boven
          </a>
        </div>
        <div>
          <h2 className="sr-only">Contact</h2>
          <a
            href={`mailto:${SITE.email}`}
            className="block font-semibold leading-[0.9] tracking-[-0.045em] break-words transition-opacity hover:opacity-90"
            style={{ fontSize: "clamp(2.6rem, 8.6vw, 9rem)" }}
          >
            {user}
            <wbr />@{host}
          </a>
          <div className="mt-10 grid gap-3 text-sm md:grid-cols-3">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              <li>
                <Link href="/tools" className="s-link">
                  Gratis tools
                </Link>
              </li>
              <li>
                <Link href="/prijzen" className="s-link">
                  Prijzen
                </Link>
              </li>
              <li>
                <Link href="/blog" className="s-link">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/docs/api" className="s-link">
                  API
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="s-link">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/voorwaarden" className="s-link">
                  Voorwaarden
                </Link>
              </li>
              <li>
                <Link href="/affiliate" className="s-link">
                  Affiliate
                </Link>
              </li>
              <li>
                <Link href="/opt-out" className="s-link">
                  Shop laten verwijderen
                </Link>
              </li>
            </ul>
            <p className="md:text-center">Ad-data: officiële Meta Ad Library (EU)</p>
            <p className="md:text-right">
              {SITE.city}, {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
