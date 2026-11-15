import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PageTitle } from "@/components/site/prose";
import { formatDate, POSTS } from "@/lib/site/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Over webshops in Nederland en België: omzet schatten, ads onderzoeken en tools kiezen.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  return (
    <PageShell>
      <PageTitle
        title="Blog"
        lead="Over webshops in Nederland en België: wat ze verkopen, hoe ze adverteren en hoe je dat onderzoekt."
      />
      <ul className="mt-14 grid gap-4 md:grid-cols-2">
        {POSTS.map((p) => (
          <li key={p.slug} className="s-frame s-lift">
            <Link href={`/blog/${p.slug}`} className="s-card group flex h-full flex-col p-7">
              <time dateTime={p.date} className="s-label">
                {formatDate(p.date)}
              </time>
              <h2 className="mt-4 text-[clamp(1.5rem,2.2vw,2rem)]">{p.title}</h2>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-[var(--s-muted)]">
                {p.description}
              </p>
              <p className="mt-6 text-[14px] text-[var(--s-faint)] transition-colors group-hover:text-[var(--s-accent-soft)]">
                Lees verder →
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
